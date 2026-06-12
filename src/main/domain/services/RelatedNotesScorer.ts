/**
 * RelatedNotesScorer — pure scoring logic behind the "Related Notes" panel.
 *
 * Relatedness is computed in two stages:
 *
 * 1. Semantic alignment (chunk-to-chunk). Every chunk of a candidate note is
 *    matched against every chunk of the source note; a note's score blends
 *    its single best pair with depth (mean of its top pairs) and breadth
 *    (how many of its chunks align strongly). This deliberately avoids
 *    querying with the source note's centroid vector: averaging a
 *    multi-topic note's chunks yields a vector close to nothing in
 *    particular, which is how generic notes end up "related" to everything.
 *
 * 2. Structural boosts. Shared tags, link-graph neighborhood overlap and
 *    same-notebook placement nudge the semantic score upward. These are
 *    high-precision signals in a PKM — two notes wiki-linked from the same
 *    hub are related in a way embeddings often miss.
 *
 * Scores are calibrated to [0, 1] so the UI percentage reads sensibly: raw
 * cosine on small embedding models occupies a narrow band (noise ≈ 0.35,
 * near-duplicate ≈ 0.85), so that band is stretched across the full range.
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
  /** Candidate chunks whose best source-pair cosine ≥ STRONG_PAIR_COSINE. */
  strongChunks: number;
  /** The candidate chunk most aligned with the source note. */
  bestChunk: TChunk;
}

export interface StructuralSignals {
  /** Jaccard overlap of the two notes' tag sets, in [0, 1]. */
  tagJaccard: number;
  /** Link-graph neighborhood overlap (incl. direct links), in [0, 1]. */
  graphOverlap: number;
  sameNotebook: boolean;
}

/** Source chunks beyond this are evenly sampled to bound the pair matrix. */
const SOURCE_CHUNK_CAP = 24;

/** Cosine band stretched to [0, 1]; values outside it are clamped. */
const COSINE_NOISE_FLOOR = 0.35;
const COSINE_DUPLICATE_CEIL = 0.85;

/** A candidate chunk at or above this cosine counts toward breadth. */
const STRONG_PAIR_COSINE = 0.5;

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
const NOTEBOOK_BONUS = 0.03;

/** A direct wiki-link counts at least this much neighborhood overlap. */
const DIRECT_LINK_OVERLAP = 0.5;

export class RelatedNotesScorer {
  /**
   * Stage 1: score every candidate note by chunk-to-chunk alignment with
   * the source chunks. Returns candidates sorted by score, descending.
   */
  static scoreCandidates<TChunk extends AlignableChunk>(
    sourceChunks: TChunk[],
    candidateChunks: TChunk[],
  ): Array<SemanticCandidate<TChunk>> {
    const sourceUnits = sampleEvenly(
      sourceChunks.map((c) => toUnitVector(c.embedding)).filter(isVector),
      SOURCE_CHUNK_CAP,
    );
    if (sourceUnits.length === 0) return [];

    interface Bucket {
      pairCosines: number[];
      strongChunks: number;
      bestChunk: TChunk;
      bestCosine: number;
    }
    const buckets = new Map<string, Bucket>();

    for (const chunk of candidateChunks) {
      const unit = toUnitVector(chunk.embedding);
      if (!unit) continue;

      let best = -1;
      for (const source of sourceUnits) {
        const cos = dot(unit, source);
        if (cos > best) best = cos;
      }

      const bucket = buckets.get(chunk.noteId);
      if (!bucket) {
        buckets.set(chunk.noteId, {
          pairCosines: [best],
          strongChunks: best >= STRONG_PAIR_COSINE ? 1 : 0,
          bestChunk: chunk,
          bestCosine: best,
        });
      } else {
        bucket.pairCosines.push(best);
        if (best >= STRONG_PAIR_COSINE) bucket.strongChunks += 1;
        if (best > bucket.bestCosine) {
          bucket.bestCosine = best;
          bucket.bestChunk = chunk;
        }
      }
    }

    const candidates: Array<SemanticCandidate<TChunk>> = [];
    for (const [noteId, bucket] of buckets) {
      const top = bucket.pairCosines.sort((a, b) => b - a).slice(0, DEPTH_TOP_K);
      const depth = top.reduce((sum, v) => sum + v, 0) / top.length;
      const raw = BEST_PAIR_WEIGHT * bucket.bestCosine + DEPTH_WEIGHT * depth;
      const calibrated = clamp01(
        (raw - COSINE_NOISE_FLOOR) / (COSINE_DUPLICATE_CEIL - COSINE_NOISE_FLOOR),
      );
      const breadthBonus =
        BREADTH_BONUS_MAX *
        clamp01(Math.max(bucket.strongChunks - 1, 0) / bucket.pairCosines.length);
      candidates.push({
        noteId,
        semanticScore: Math.min(1, calibrated + breadthBonus),
        strongChunks: bucket.strongChunks,
        bestChunk: bucket.bestChunk,
      });
    }

    return candidates.sort((a, b) => b.semanticScore - a.semanticScore);
  }

  /** Stage 2: fold structural signals into a final score in [0, 1]. */
  static finalScore(semanticScore: number, signals: StructuralSignals): number {
    return Math.min(
      1,
      semanticScore +
        TAG_WEIGHT * signals.tagJaccard +
        GRAPH_WEIGHT * signals.graphOverlap +
        (signals.sameNotebook ? NOTEBOOK_BONUS : 0),
    );
  }

  static tagJaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    for (const id of a) if (b.has(id)) intersection += 1;
    return intersection / (a.size + b.size - intersection);
  }

  /**
   * Neighborhood overlap of two notes in the wiki-link graph (cosine over
   * adjacency sets), with a direct link guaranteeing a minimum overlap.
   */
  static graphOverlap(
    aNeighbors: ReadonlySet<string>,
    bNeighbors: ReadonlySet<string>,
    directlyLinked: boolean,
  ): number {
    let overlap = 0;
    if (aNeighbors.size > 0 && bNeighbors.size > 0) {
      let shared = 0;
      for (const id of aNeighbors) if (bNeighbors.has(id)) shared += 1;
      overlap = shared / Math.sqrt(aNeighbors.size * bNeighbors.size);
    }
    return directlyLinked ? Math.max(overlap, DIRECT_LINK_OVERLAP) : overlap;
  }
}

function toUnitVector(embedding: number[] | null): Float64Array | null {
  if (!embedding || embedding.length === 0) return null;
  let normSq = 0;
  for (let i = 0; i < embedding.length; i += 1) normSq += embedding[i] * embedding[i];
  if (normSq === 0) return null;
  const norm = Math.sqrt(normSq);
  const unit = new Float64Array(embedding.length);
  for (let i = 0; i < embedding.length; i += 1) unit[i] = embedding[i] / norm;
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
