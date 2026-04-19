/**
 * SearchRanker - Pure domain service for ranking, combining, and filtering search results.
 *
 * Encapsulates the business rules around search result assembly:
 * - default weights for hybrid (FTS + semantic) ranking
 * - weighted score combination when results come from multiple search strategies
 * - converting vector distance into a similarity score in [0, 1]
 * - excluding specific note IDs (e.g. the source note in "find similar")
 * - enforcing a result limit
 * - filtering notes whose timestamp falls within an inclusive date range
 * - offset/limit pagination over a result list
 *
 * All functions are pure: no I/O, no side effects, no external dependencies.
 */

/**
 * Default weight for full-text search score contribution in hybrid ranking.
 */
export const DEFAULT_FTS_WEIGHT = 0.5;

/**
 * Default weight for semantic search score contribution in hybrid ranking.
 */
export const DEFAULT_SEMANTIC_WEIGHT = 0.5;

/**
 * Score assigned to a result when only one search strategy produced it
 * and no independent scoring information is available.
 */
export const DEFAULT_SINGLE_SOURCE_SCORE = 1;

export interface RankingWeights {
  fts: number;
  semantic: number;
}

export interface HasId {
  id: string;
}

export interface HasNoteId {
  noteId: string;
}

export const SearchRanker = {
  /**
   * Resolve the weights used for hybrid ranking, falling back to defaults
   * and normalizing so the pair sums to 1. If both weights are zero or
   * missing, the defaults are returned untouched.
   */
  resolveWeights(weights?: Partial<RankingWeights>): RankingWeights {
    const fts = weights?.fts ?? DEFAULT_FTS_WEIGHT;
    const semantic = weights?.semantic ?? DEFAULT_SEMANTIC_WEIGHT;
    const total = fts + semantic;

    if (total <= 0) {
      return { fts: DEFAULT_FTS_WEIGHT, semantic: DEFAULT_SEMANTIC_WEIGHT };
    }

    return { fts: fts / total, semantic: semantic / total };
  },

  /**
   * Combine a full-text score and a semantic score into a single hybrid score
   * using the supplied (or default) weights. Missing scores are treated as 0.
   */
  combineScores(
    ftsScore: number | undefined,
    semanticScore: number | undefined,
    weights?: Partial<RankingWeights>,
  ): number {
    const resolved = this.resolveWeights(weights);
    return (ftsScore ?? 0) * resolved.fts + (semanticScore ?? 0) * resolved.semantic;
  },

  /**
   * Convert a vector distance into a similarity score in [0, 1].
   * Uses 1 / (1 + distance) so that distance 0 maps to 1 and large
   * distances asymptote to 0. Negative inputs are clamped to 0.
   */
  distanceToSimilarity(distance: number): number {
    if (!Number.isFinite(distance) || distance <= 0) {
      return distance === 0 ? 1 : 0;
    }
    return 1 / (1 + distance);
  },

  /**
   * Filter out any result whose `noteId` matches the excluded id.
   */
  excludeNoteId<T extends HasNoteId>(results: T[], excludedId: string): T[] {
    return results.filter((r) => r.noteId !== excludedId);
  },

  /**
   * Return at most `limit` items from the front of `results`. If `limit` is
   * undefined or non-positive, returns the input unchanged.
   */
  applyLimit<T>(results: T[], limit?: number): T[] {
    if (limit === undefined || limit <= 0) return results;
    return results.slice(0, limit);
  },

  /**
   * Keep only items whose selected date field falls within the inclusive
   * [startDate, endDate] range.
   */
  filterByDateRange<T>(
    items: T[],
    getDate: (item: T) => Date,
    startDate: Date,
    endDate: Date,
  ): T[] {
    return items.filter((item) => {
      const d = getDate(item);
      return d >= startDate && d <= endDate;
    });
  },

  /**
   * Apply offset + limit pagination. If `limit` is undefined, all items
   * from `offset` onward are returned.
   */
  paginate<T>(items: T[], offset: number = 0, limit?: number): T[] {
    const start = Math.max(0, offset);
    if (limit === undefined) return items.slice(start);
    return items.slice(start, start + Math.max(0, limit));
  },
};
