/**
 * TopicSuggester - pure clustering over chunk embeddings to surface "topics
 * we should probably exist" without any manual setup.
 *
 * Strategy: greedy density-based agglomerative single-pass. For each chunk,
 * count how many other chunks fall within `cosineThreshold`. Pick the
 * densest unvisited chunk as the seed of a cluster; everything within
 * threshold of the seed joins; mark all as visited; repeat until no seed
 * has at least `minClusterSize` neighbors.
 *
 * Then derive a human-readable label per cluster from distinctive bigrams
 * — common in the cluster's chunk text, rare elsewhere (TF-IDF-ish).
 *
 * Pure: no I/O, no AI SDK, no npm. Deterministic — same input → same output.
 */

export interface SuggesterChunk {
  chunkId: string;
  noteId: string;
  noteTitle: string;
  headingPath: string[];
  text: string;
  embedding: number[];
}

export interface SuggesterOptions {
  /** Minimum cosine similarity for two chunks to be in the same cluster. */
  cosineThreshold: number;
  /** Reject clusters smaller than this. */
  minClusterSize: number;
  /** Hard cap on how many clusters to return (best-density first). */
  maxClusters: number;
  /** How many representative chunks to attach to each cluster. */
  representativesPerCluster: number;
}

export interface SuggestedCluster {
  id: string;
  label: string;
  /** Best-guess alternate labels, ranked. UI can show as edit suggestions. */
  altLabels: string[];
  chunkIds: string[];
  noteIds: string[];
  noteCount: number;
  chunkCount: number;
  /** Top-N most central chunks (closest to cluster centroid). */
  representatives: Array<{
    chunkId: string;
    noteId: string;
    noteTitle: string;
    headingPath: string[];
    excerpt: string;
  }>;
  /** Cosine similarity of the tightest pair → loose pair, for diagnostics. */
  cohesion: number;
}

const DEFAULTS: SuggesterOptions = {
  cosineThreshold: 0.55,
  minClusterSize: 4,
  maxClusters: 12,
  representativesPerCluster: 3,
};

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'while',
  'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'into',
  'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'have', 'has', 'had', 'do', 'does', 'did', 'doing', 'done',
  'will', 'would', 'should', 'could', 'may', 'might', 'must', 'shall',
  'can', 'cannot', 'cant', 'couldnt', 'wouldnt', 'shouldnt',
  'this', 'that', 'these', 'those', 'i', 'me', 'my', 'mine', 'we', 'us',
  'our', 'ours', 'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her',
  'hers', 'it', 'its', 'they', 'them', 'their', 'theirs', 'what', 'which',
  'who', 'whom', 'whose', 'when', 'where', 'why', 'how',
  'not', 'no', 'yes', 'so', 'than', 'too', 'very', 'just', 'also',
  'one', 'two', 'three', 'first', 'second', 'last', 'next',
  'something', 'someone', 'anything', 'everything', 'nothing',
  'todo', 'done', 'note', 'notes',
]);

const MIN_TOKEN_LENGTH = 3;

export class TopicSuggester {
  static suggest(chunks: SuggesterChunk[], opts: Partial<SuggesterOptions> = {}): SuggestedCluster[] {
    const options: SuggesterOptions = { ...DEFAULTS, ...opts };
    if (chunks.length < options.minClusterSize) return [];

    // Defensive: drop chunks with missing or zero vectors.
    const valid = chunks.filter((c) => c.embedding && c.embedding.length > 0);
    if (valid.length < options.minClusterSize) return [];

    const n = valid.length;
    const norms = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      norms[i] = vecNorm(valid[i].embedding);
    }

    // Greedy density-based clustering. For each unvisited chunk, gather its
    // similarity neighbors above the threshold; seed = densest one. Members
    // are everyone above threshold of the seed.
    const visited = new Uint8Array(n);
    // Pre-compute neighbor density for seed selection. Computing full pairwise
    // is O(n²) but 1000 chunks = 1M ops — fine for this scale.
    const neighborCounts = new Int32Array(n);
    const neighborLists: number[][] = [];
    for (let i = 0; i < n; i += 1) {
      const neighbors: number[] = [];
      for (let j = 0; j < n; j += 1) {
        if (i === j) continue;
        const sim = cosine(valid[i].embedding, valid[j].embedding, norms[i], norms[j]);
        if (sim >= options.cosineThreshold) neighbors.push(j);
      }
      neighborLists.push(neighbors);
      neighborCounts[i] = neighbors.length;
    }

    const clusters: SuggestedCluster[] = [];
    let clusterIndex = 0;

    while (clusters.length < options.maxClusters) {
      // Pick the densest unvisited chunk as the next seed.
      let seedIdx = -1;
      let seedCount = -1;
      for (let i = 0; i < n; i += 1) {
        if (visited[i]) continue;
        if (neighborCounts[i] > seedCount) {
          seedCount = neighborCounts[i];
          seedIdx = i;
        }
      }
      if (seedIdx === -1 || seedCount + 1 < options.minClusterSize) break;

      const memberIdxs: number[] = [seedIdx];
      for (const j of neighborLists[seedIdx]) {
        if (!visited[j]) memberIdxs.push(j);
      }
      if (memberIdxs.length < options.minClusterSize) {
        // Mark only the seed visited; otherwise we'd skip valid candidates.
        visited[seedIdx] = 1;
        continue;
      }
      for (const idx of memberIdxs) visited[idx] = 1;

      clusters.push(buildCluster(clusterIndex, memberIdxs, valid, options));
      clusterIndex += 1;
    }

    // Pass 2: label clusters with distinctive bigrams across the full set.
    assignLabels(clusters);
    return clusters;
  }
}

/* ---------- clustering helpers ---------- */

function buildCluster(
  index: number,
  memberIdxs: number[],
  chunks: SuggesterChunk[],
  options: SuggesterOptions,
): SuggestedCluster {
  const members = memberIdxs.map((i) => chunks[i]);
  const dims = members[0].embedding.length;
  const centroid = new Float32Array(dims);
  for (const m of members) {
    for (let d = 0; d < dims; d += 1) centroid[d] += m.embedding[d];
  }
  for (let d = 0; d < dims; d += 1) centroid[d] /= members.length;

  // Rank members by centrality (cosine to centroid).
  const cNorm = vecNorm(Array.from(centroid));
  const ranked = members
    .map((m) => ({ m, sim: cosine(m.embedding, Array.from(centroid), vecNorm(m.embedding), cNorm) }))
    .sort((a, b) => b.sim - a.sim);

  const representatives = ranked.slice(0, options.representativesPerCluster).map(({ m, sim }) => ({
    chunkId: m.chunkId,
    noteId: m.noteId,
    noteTitle: m.noteTitle,
    headingPath: m.headingPath,
    excerpt: truncate(m.text.replace(/\s+/g, ' ').trim(), 240),
    _sim: sim,
  }));

  const noteIds = Array.from(new Set(members.map((m) => m.noteId)));
  const chunkIds = members.map((m) => m.chunkId);

  // Cohesion = mean cosine to centroid; ~ how "tight" the cluster is.
  const cohesion = ranked.reduce((acc, r) => acc + r.sim, 0) / ranked.length;

  return {
    id: `suggestion-${index}`,
    label: '', // assigned in pass 2
    altLabels: [],
    chunkIds,
    noteIds,
    noteCount: noteIds.length,
    chunkCount: chunkIds.length,
    representatives: representatives.map(({ _sim, ...r }) => r),
    cohesion,
  };
}

/* ---------- labelling helpers ---------- */

function assignLabels(clusters: SuggestedCluster[]): void {
  if (clusters.length === 0) return;

  // Build per-cluster bigram counts plus a global document-frequency map.
  const perClusterCounts: Map<string, number>[] = clusters.map(() => new Map());
  const documentFreq = new Map<string, number>();

  for (let i = 0; i < clusters.length; i += 1) {
    const cluster = clusters[i];
    const counts = perClusterCounts[i];
    const seenInCluster = new Set<string>();

    for (const rep of cluster.representatives) {
      const tokens = tokenize(`${rep.noteTitle} ${rep.headingPath.join(' ')} ${rep.excerpt}`);
      for (const term of buildNgrams(tokens, 1, 2)) {
        counts.set(term, (counts.get(term) ?? 0) + 1);
        seenInCluster.add(term);
      }
    }
    for (const term of seenInCluster) {
      documentFreq.set(term, (documentFreq.get(term) ?? 0) + 1);
    }
  }

  const totalClusters = clusters.length;
  for (let i = 0; i < clusters.length; i += 1) {
    const counts = perClusterCounts[i];
    const ranked: Array<{ term: string; score: number }> = [];
    for (const [term, tf] of counts) {
      const df = documentFreq.get(term) ?? 1;
      // TF-IDF-ish: rare-across-clusters terms score higher, with a small
      // length bonus that nudges 2-grams over 1-grams when scores tie.
      const idf = Math.log((totalClusters + 1) / df);
      const lengthBonus = term.includes(' ') ? 0.15 : 0;
      const score = tf * idf + lengthBonus;
      ranked.push({ term, score });
    }
    ranked.sort((a, b) => b.score - a.score);

    const labels: string[] = [];
    const seen = new Set<string>();
    for (const { term } of ranked) {
      const display = titleCase(term);
      // Skip labels that are just a subword of an already-chosen label.
      let dominated = false;
      for (const existing of labels) {
        const a = existing.toLowerCase();
        const b = display.toLowerCase();
        if (a.includes(b) || b.includes(a)) {
          dominated = true;
          break;
        }
      }
      if (dominated || seen.has(display)) continue;
      seen.add(display);
      labels.push(display);
      if (labels.length >= 3) break;
    }

    clusters[i].label = labels[0] ?? fallbackLabelFromHeading(clusters[i]);
    clusters[i].altLabels = labels.slice(1);
  }
}

function fallbackLabelFromHeading(cluster: SuggestedCluster): string {
  for (const rep of cluster.representatives) {
    if (rep.headingPath.length > 0) {
      return titleCase(rep.headingPath[rep.headingPath.length - 1]);
    }
  }
  return cluster.representatives[0]?.noteTitle || 'Untitled cluster';
}

function tokenize(text: string): string[] {
  const lowered = text.toLowerCase();
  const tokens: string[] = [];
  let current = '';
  for (let i = 0; i < lowered.length; i += 1) {
    const ch = lowered.charCodeAt(i);
    // ASCII letters / digits / underscore — anything else ends the token.
    const isWord =
      (ch >= 97 && ch <= 122) || (ch >= 48 && ch <= 57) || ch === 95;
    if (isWord) {
      current += lowered[i];
    } else if (current) {
      if (current.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(current) && !isAllDigits(current)) {
        tokens.push(current);
      }
      current = '';
    }
  }
  if (current && current.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(current) && !isAllDigits(current)) {
    tokens.push(current);
  }
  return tokens;
}

function buildNgrams(tokens: string[], minN: number, maxN: number): string[] {
  const out: string[] = [];
  for (let n = minN; n <= maxN; n += 1) {
    for (let i = 0; i <= tokens.length - n; i += 1) {
      const gram = tokens.slice(i, i + n).join(' ');
      out.push(gram);
    }
  }
  return out;
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

function isAllDigits(s: string): boolean {
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  return true;
}

/* ---------- vector helpers ---------- */

function vecNorm(v: number[] | Float32Array): number {
  let sum = 0;
  for (let i = 0; i < v.length; i += 1) sum += v[i] * v[i];
  return Math.sqrt(sum);
}

function cosine(
  a: number[] | Float32Array,
  b: number[] | Float32Array,
  na: number,
  nb: number,
): number {
  if (na === 0 || nb === 0) return 0;
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) dot += a[i] * b[i];
  return dot / (na * nb);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}
