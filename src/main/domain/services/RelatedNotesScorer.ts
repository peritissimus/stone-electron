/**
 * RelatedNotesScorer — pure scoring logic behind the "Related Notes" panel.
 *
 * Relatedness is computed in two stages:
 *
 * 1. Semantic alignment (chunk-to-chunk). Every chunk of a candidate note is
 *    matched against every chunk of the source note; a note's score blends
 *    its single best pair with depth (mean of its top pairs) and breadth
 *    (the fraction of its chunks that align strongly). This deliberately
 *    avoids querying with the source note's centroid vector: averaging a
 *    multi-topic note's chunks yields a vector close to nothing in
 *    particular, which is how generic notes end up "related" to everything.
 *
 *    Scores are calibrated against the workspace itself. Small embedding
 *    models are anisotropic — all cosines bunch into a narrow band — so raw
 *    cosine thresholds are fragile across models and corpora. When the
 *    corpus is large enough we (a) mean-center embeddings on the corpus
 *    centroid, which removes the shared "cone" direction, and (b) estimate
 *    the noise distribution from sampled cross-note chunk pairs, placing
 *    the score floor at noise-mean + 3σ. Near-duplicates keep cosine ≈ 1
 *    after centering (both vectors shift identically), so the ceiling is a
 *    model-independent constant. Tiny corpora fall back to a fixed band.
 *
 * 2. Structural boosts. Shared tags, link-graph overlap (Adamic-Adar over
 *    co-citation + bibliographic coupling), lexical term overlap, and
 *    same-notebook placement nudge the semantic score upward; journal/daily
 *    notes are demoted. These signals are high-precision in a PKM — two
 *    notes wiki-linked from the same hub are related in a way embeddings
 *    often miss — but structure alone never surfaces a semantically
 *    unrelated note.
 */

export interface AlignableChunk {
  id: string;
  noteId: string;
  embedding: number[] | null;
}

export interface SemanticCandidate<TChunk extends AlignableChunk> {
  noteId: string;
  /** Calibrated semantic score in [0, 1]. */
  semanticScore: number;
  /** Candidate chunks whose best source-pair share clears the strong bar. */
  strongChunks: number;
  /** The candidate chunk most aligned with the source note. */
  bestChunk: TChunk;
}

export interface StructuralSignals {
  /** Jaccard overlap of the two notes' tag sets, in [0, 1]. */
  tagJaccard: number;
  /** Adamic-Adar link-graph overlap (incl. direct links), in [0, 1]. */
  graphOverlap: number;
  /** Lexical (distinctive-term) match strength, in [0, 1]. */
  lexicalStrength: number;
  sameNotebook: boolean;
  /** Daily/journal notes are demoted so they don't crowd topical notes. */
  isJournal: boolean;
}

/** Source chunks beyond this are evenly sampled to bound the pair matrix. */
const SOURCE_CHUNK_CAP = 24;

/**
 * Corpus-calibrated mode needs enough data to estimate noise; below these
 * floors we use raw cosines with a fixed band instead.
 */
const MIN_NOTES_FOR_CALIBRATION = 8;
const MIN_CHUNKS_FOR_CALIBRATION = 64;
const MIN_NOISE_PAIRS = 32;
const NOISE_SAMPLE_TARGET = 512;

/**
 * Calibrated mode: floor = noise mean + 3σ (an alignment indistinguishable
 * from random cross-note pairs scores 0), capped so a degenerate
 * single-topic corpus cannot push the floor above real matches. Ceiling is
 * fixed: centering preserves self-similarity, so near-duplicates sit at
 * cosine ≈ 0.9+ regardless of the embedding model.
 */
const NOISE_FLOOR_SIGMAS = 3;
const CALIBRATED_FLOOR_MAX = 0.6;
const CALIBRATED_CEIL = 0.9;

/** Fallback band for tiny corpora (raw, uncentered cosines). */
const FALLBACK_NOISE_FLOOR = 0.35;
const FALLBACK_DUPLICATE_CEIL = 0.85;

/** A chunk whose calibrated share clears this counts toward breadth. */
const STRONG_PAIR_SHARE = 0.45;

/** Blend of the single best pair vs. the mean of the top pairs. */
const BEST_PAIR_WEIGHT = 0.7;
const DEPTH_WEIGHT = 0.3;
const DEPTH_TOP_K = 3;

/**
 * Breadth bonus scales with the FRACTION of the candidate's chunks that
 * align strongly, not the raw count — a raw count would hand long notes
 * (daily journals, hub notes) the full bonus just for having many chunks.
 */
const BREADTH_BONUS_MAX = 0.12;

/** Structural boost weights. Semantics stay the dominant signal. */
const TAG_WEIGHT = 0.12;
const GRAPH_WEIGHT = 0.1;
const LEXICAL_WEIGHT = 0.1;
const NOTEBOOK_BONUS = 0.03;

/** A direct wiki-link counts at least this much graph overlap. */
const DIRECT_LINK_OVERLAP = 0.5;

/** Multiplier applied to journal/daily notes' final score. */
const JOURNAL_DEMOTION = 0.8;

/** Tokens for the lexical leg: ≥ 3 chars, not a stopword, not a number. */
const MIN_TERM_LENGTH = 3;
const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
  'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'its',
  'did', 'yes', 'this', 'that', 'with', 'from', 'they', 'will', 'would',
  'there', 'their', 'what', 'about', 'which', 'when', 'make', 'like',
  'time', 'just', 'know', 'take', 'into', 'your', 'some', 'could', 'them',
  'than', 'then', 'only', 'over', 'also', 'after', 'most', 'other', 'have',
  'been', 'were', 'because', 'these', 'those', 'where', 'while', 'should',
  'very', 'more', 'here', 'each', 'does', 'doing', 'done', 'still', 'such',
]);

export class RelatedNotesScorer {
  /**
   * Stage 1: score every candidate note by chunk-to-chunk alignment with
   * the source chunks. Returns candidates sorted by score, descending.
   */
  static scoreCandidates<TChunk extends AlignableChunk>(
    sourceChunks: TChunk[],
    candidateChunks: TChunk[],
  ): Array<SemanticCandidate<TChunk>> {
    const sourceVectors = sourceChunks
      .map((c) => c.embedding)
      .filter((e): e is number[] => e !== null && e.length > 0);
    if (sourceVectors.length === 0) return [];

    const candidateVectors: number[][] = [];
    const candidateOwners: TChunk[] = [];
    for (const chunk of candidateChunks) {
      if (chunk.embedding && chunk.embedding.length > 0) {
        candidateVectors.push(chunk.embedding);
        candidateOwners.push(chunk);
      }
    }
    if (candidateVectors.length === 0) return [];

    const distinctNotes = new Set(candidateOwners.map((c) => c.noteId)).size;
    const calibrate =
      distinctNotes >= MIN_NOTES_FOR_CALIBRATION &&
      candidateVectors.length + sourceVectors.length >= MIN_CHUNKS_FOR_CALIBRATION;

    const centroid = calibrate
      ? meanVector([...sourceVectors, ...candidateVectors])
      : null;
    const sourceUnits = sampleEvenly(
      sourceVectors.map((v) => toUnitVector(v, centroid)).filter(isVector),
      SOURCE_CHUNK_CAP,
    );
    if (sourceUnits.length === 0) return [];

    const candidateUnits = candidateVectors.map((v) => toUnitVector(v, centroid));

    // Calibration band: adaptive (noise stats) or fixed (tiny corpus).
    let floor = FALLBACK_NOISE_FLOOR;
    let ceil = FALLBACK_DUPLICATE_CEIL;
    if (calibrate) {
      const noise = estimateNoisePairStats(candidateUnits, candidateOwners);
      if (noise) {
        floor = Math.min(noise.mean + NOISE_FLOOR_SIGMAS * noise.sigma, CALIBRATED_FLOOR_MAX);
        ceil = CALIBRATED_CEIL;
      }
    }

    interface Bucket {
      pairShares: number[];
      strongChunks: number;
      bestChunk: TChunk;
      bestShare: number;
    }
    const buckets = new Map<string, Bucket>();

    for (let i = 0; i < candidateUnits.length; i += 1) {
      const unit = candidateUnits[i];
      if (!unit) continue;
      const chunk = candidateOwners[i];

      let best = -1;
      for (const source of sourceUnits) {
        const cos = dot(unit, source);
        if (cos > best) best = cos;
      }
      const share = clamp01((best - floor) / (ceil - floor));

      const bucket = buckets.get(chunk.noteId);
      if (!bucket) {
        buckets.set(chunk.noteId, {
          pairShares: [share],
          strongChunks: share >= STRONG_PAIR_SHARE ? 1 : 0,
          bestChunk: chunk,
          bestShare: share,
        });
      } else {
        bucket.pairShares.push(share);
        if (share >= STRONG_PAIR_SHARE) bucket.strongChunks += 1;
        if (share > bucket.bestShare) {
          bucket.bestShare = share;
          bucket.bestChunk = chunk;
        }
      }
    }

    const candidates: Array<SemanticCandidate<TChunk>> = [];
    for (const [noteId, bucket] of buckets) {
      const top = bucket.pairShares.sort((a, b) => b - a).slice(0, DEPTH_TOP_K);
      const depth = top.reduce((sum, v) => sum + v, 0) / top.length;
      const aligned = BEST_PAIR_WEIGHT * bucket.bestShare + DEPTH_WEIGHT * depth;
      const breadthBonus =
        BREADTH_BONUS_MAX *
        clamp01(Math.max(bucket.strongChunks - 1, 0) / bucket.pairShares.length);
      candidates.push({
        noteId,
        semanticScore: Math.min(1, aligned + breadthBonus),
        strongChunks: bucket.strongChunks,
        bestChunk: bucket.bestChunk,
      });
    }

    return candidates.sort((a, b) => b.semanticScore - a.semanticScore);
  }

  /** Stage 2: fold structural signals into a final score in [0, 1]. */
  static finalScore(semanticScore: number, signals: StructuralSignals): number {
    const boosted = Math.min(
      1,
      semanticScore +
        TAG_WEIGHT * signals.tagJaccard +
        GRAPH_WEIGHT * signals.graphOverlap +
        LEXICAL_WEIGHT * signals.lexicalStrength +
        (signals.sameNotebook ? NOTEBOOK_BONUS : 0),
    );
    return signals.isJournal ? boosted * JOURNAL_DEMOTION : boosted;
  }

  static tagJaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    for (const id of a) if (b.has(id)) intersection += 1;
    return intersection / (a.size + b.size - intersection);
  }

  /**
   * Adamic-Adar overlap of two notes in the wiki-link graph, normalized to
   * [0, 1]. Neighbor sets are undirected, so this covers both co-citation
   * (shared inbound linkers) and bibliographic coupling (shared outbound
   * targets). Each common neighbor counts 1/ln(degree+1) — a hub note that
   * links to everything is weak evidence that two of its targets are
   * related, while a tightly-scoped note linking to both is strong
   * evidence. A direct link guarantees a minimum overlap.
   */
  static graphOverlap(
    aNeighbors: ReadonlySet<string>,
    bNeighbors: ReadonlySet<string>,
    degreeOf: (noteId: string) => number,
    directlyLinked: boolean,
  ): number {
    let overlap = 0;
    if (aNeighbors.size > 0 && bNeighbors.size > 0) {
      const weight = (id: string) => 1 / Math.log(Math.max(degreeOf(id), 2) + 1);
      let shared = 0;
      for (const id of aNeighbors) if (bNeighbors.has(id)) shared += weight(id);
      if (shared > 0) {
        let weightA = 0;
        for (const id of aNeighbors) weightA += weight(id);
        let weightB = 0;
        for (const id of bNeighbors) weightB += weight(id);
        overlap = shared / Math.sqrt(weightA * weightB);
      }
    }
    return directlyLinked ? Math.max(overlap, DIRECT_LINK_OVERLAP) : overlap;
  }

  /**
   * Top distinctive terms of the source note by TF-IDF over the workspace,
   * for the lexical (full-text) leg. `corpusDocs` is one concatenated text
   * per other note; document frequency comes from those.
   */
  static distinctiveTerms(
    sourceTexts: string[],
    corpusDocs: string[],
    topN: number,
  ): string[] {
    const termFreq = new Map<string, number>();
    for (const text of sourceTexts) {
      for (const term of tokenize(text)) {
        termFreq.set(term, (termFreq.get(term) ?? 0) + 1);
      }
    }
    if (termFreq.size === 0) return [];

    const docFreq = new Map<string, number>();
    for (const doc of corpusDocs) {
      for (const term of new Set(tokenize(doc))) {
        if (termFreq.has(term)) docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
      }
    }

    const totalDocs = corpusDocs.length + 1;
    return [...termFreq.entries()]
      .map(([term, tf]) => ({
        term,
        score: tf * Math.log(totalDocs / (1 + (docFreq.get(term) ?? 0))),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map((e) => e.term);
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}_-]+/u)
    .filter(
      (t) => t.length >= MIN_TERM_LENGTH && !STOPWORDS.has(t) && !/^[\d_-]+$/.test(t),
    );
}

/**
 * Mean and standard deviation of cosines between deterministically sampled
 * cross-note chunk pairs — the "how similar is unrelated content in this
 * corpus" baseline. Deterministic sampling (fixed offset + stride) keeps
 * scores stable across refetches of the same corpus. Returns null when too
 * few valid pairs exist.
 */
function estimateNoisePairStats(
  units: Array<Float64Array | null>,
  owners: Array<{ noteId: string }>,
): { mean: number; sigma: number } | null {
  const n = units.length;
  if (n < 2) return null;

  const cosines: number[] = [];
  const offset = Math.max(1, Math.floor(n / 2));
  const step = Math.max(1, Math.floor(n / NOISE_SAMPLE_TARGET));
  for (let i = 0; i < n && cosines.length < NOISE_SAMPLE_TARGET; i += step) {
    const j = (i + offset) % n;
    const a = units[i];
    const b = units[j];
    if (!a || !b || i === j) continue;
    if (owners[i].noteId === owners[j].noteId) continue;
    cosines.push(dot(a, b));
  }
  if (cosines.length < MIN_NOISE_PAIRS) return null;

  const mean = cosines.reduce((s, v) => s + v, 0) / cosines.length;
  const variance =
    cosines.reduce((s, v) => s + (v - mean) * (v - mean), 0) / cosines.length;
  const sigma = Math.sqrt(variance);
  return sigma > 1e-6 ? { mean, sigma } : null;
}

function meanVector(vectors: number[][]): Float64Array | null {
  if (vectors.length === 0) return null;
  const dims = vectors[0].length;
  const mean = new Float64Array(dims);
  let used = 0;
  for (const v of vectors) {
    if (v.length !== dims) continue;
    for (let i = 0; i < dims; i += 1) mean[i] += v[i];
    used += 1;
  }
  if (used === 0) return null;
  for (let i = 0; i < dims; i += 1) mean[i] /= used;
  return mean;
}

function toUnitVector(
  embedding: number[],
  centroid: Float64Array | null,
): Float64Array | null {
  if (embedding.length === 0) return null;
  if (centroid && centroid.length !== embedding.length) return null;
  const unit = new Float64Array(embedding.length);
  let normSq = 0;
  for (let i = 0; i < embedding.length; i += 1) {
    const v = centroid ? embedding[i] - centroid[i] : embedding[i];
    unit[i] = v;
    normSq += v * v;
  }
  if (normSq === 0) return null;
  const norm = Math.sqrt(normSq);
  for (let i = 0; i < embedding.length; i += 1) unit[i] /= norm;
  return unit;
}

function isVector(v: Float64Array | null): v is Float64Array {
  return v !== null;
}

function dot(a: Float64Array, b: Float64Array): number {
  if (a.length !== b.length) return -1;
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

function sampleEvenly<T>(items: T[], cap: number): T[] {
  if (items.length <= cap) return items;
  const sampled: T[] = [];
  const stride = items.length / cap;
  for (let i = 0; i < cap; i += 1) sampled.push(items[Math.floor(i * stride)]);
  return sampled;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
