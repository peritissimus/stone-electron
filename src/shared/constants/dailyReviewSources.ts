/**
 * The external sources a daily review can draw on.
 *
 * Named once because every place that enumerated them had to be found again
 * whenever one was added — the wire schema, the store's initial state, and each
 * loop that reports a failure across all of them. Deriving the schema from this
 * list means a new source cannot be half-added.
 *
 * Order here carries no meaning. `ExternalSourceRegistry` sequences loads
 * deliberately, and states that separately.
 */
export const DAILY_REVIEW_SOURCES = ['calendar', 'mail', 'linear'] as const;

export type DailyReviewSourceId = (typeof DAILY_REVIEW_SOURCES)[number];
