/**
 * TopicCurator - decides which suggested clusters are worth promoting to real
 * topics when there is no human in the loop.
 *
 * TopicSuggester answers "what clusters exist?"; the curator answers "which of
 * those should the workspace actually keep?". It is the guard that keeps
 * automatic organization from drowning a workspace in near-duplicate or
 * low-confidence topics:
 *
 *   - a cluster must be tight enough (cohesion) and span enough notes
 *   - its label must not collide with a topic that already exists, nor with
 *     another label promoted in the same pass; alternate labels are tried
 *     before a colliding cluster is dropped
 *   - the number of topics created per pass, and in total, is capped
 *
 * Pure and deterministic: same clusters + same existing topics → same result.
 */

export interface CuratorCluster {
  label: string;
  altLabels: string[];
  noteIds: string[];
  noteCount: number;
  cohesion: number;
}

export interface CuratorExistingTopic {
  name: string;
}

export interface CurationOptions {
  /** Mean cosine-to-centroid a cluster must reach to be promoted. */
  minCohesion: number;
  /** A topic spanning fewer notes than this is noise, not a theme. */
  minNoteCount: number;
  /** Upper bound on topics created in a single pass. */
  maxNewTopicsPerPass: number;
  /** Upper bound on topics the workspace may hold in total. */
  maxTotalTopics: number;
}

export interface CuratedTopic {
  name: string;
  color: string;
  noteIds: string[];
  /** Assignment confidence for members — the cluster's cohesion. */
  confidence: number;
}

const DEFAULTS: CurationOptions = {
  minCohesion: 0.62,
  minNoteCount: 3,
  maxNewTopicsPerPass: 3,
  maxTotalTopics: 24,
};

/** Muted, evenly spaced hues. Chosen by label so a topic keeps its color. */
const PALETTE = [
  '#6366f1',
  '#0ea5e9',
  '#14b8a6',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#a855f7',
];

export class TopicCurator {
  static curate(
    clusters: CuratorCluster[],
    existingTopics: CuratorExistingTopic[],
    opts: Partial<CurationOptions> = {},
  ): CuratedTopic[] {
    const options: CurationOptions = { ...DEFAULTS, ...opts };
    const budget = Math.min(
      options.maxNewTopicsPerPass,
      options.maxTotalTopics - existingTopics.length,
    );
    if (budget <= 0) return [];

    const taken = new Set(existingTopics.map((topic) => normalize(topic.name)));
    const eligible = clusters
      .filter(
        (cluster) =>
          cluster.cohesion >= options.minCohesion &&
          cluster.noteCount >= options.minNoteCount &&
          cluster.noteIds.length > 0,
      )
      // Tightest clusters first — the ones we are most sure about get the
      // budget, and the names they claim are the best names available.
      .sort((a, b) => b.cohesion - a.cohesion || b.noteCount - a.noteCount);

    const curated: CuratedTopic[] = [];
    for (const cluster of eligible) {
      if (curated.length >= budget) break;
      const name = pickName(cluster, taken);
      if (!name) continue;
      taken.add(normalize(name));
      curated.push({
        name,
        color: colorForLabel(name),
        noteIds: Array.from(new Set(cluster.noteIds)),
        confidence: clamp(cluster.cohesion),
      });
    }
    return curated;
  }
}

/** First candidate label that is non-empty and not already claimed. */
function pickName(cluster: CuratorCluster, taken: Set<string>): string | null {
  for (const candidate of [cluster.label, ...cluster.altLabels]) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    if (taken.has(normalize(trimmed))) continue;
    return trimmed;
  }
  return null;
}

function normalize(name: string): string {
  let out = '';
  const lowered = name.toLowerCase();
  for (let i = 0; i < lowered.length; i += 1) {
    const code = lowered.charCodeAt(i);
    const isWord =
      (code >= 97 && code <= 122) || (code >= 48 && code <= 57);
    if (isWord) out += lowered[i];
    else if (out.length > 0 && out[out.length - 1] !== ' ') out += ' ';
  }
  return out.trim();
}

function colorForLabel(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

function clamp(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
