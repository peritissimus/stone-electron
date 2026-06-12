import { describe, expect, it } from 'vitest';
import { SearchRanker } from '../../../../src/main/domain/services/SearchRanker';

describe('SearchRanker', () => {
  it('normalizes weights and combines missing scores as zero', () => {
    expect(SearchRanker.resolveWeights({ fts: 2, semantic: 1 })).toEqual({
      fts: 2 / 3,
      semantic: 1 / 3,
    });
    expect(SearchRanker.resolveWeights({ fts: 0, semantic: 0 })).toEqual({
      fts: 0.5,
      semantic: 0.5,
    });
    expect(SearchRanker.combineScores(0.9, undefined, { fts: 3, semantic: 1 })).toBeCloseTo(
      0.675,
    );
  });

  it('converts distances, excludes source notes, limits, filters dates, and paginates', () => {
    expect(SearchRanker.distanceToSimilarity(0)).toBe(1);
    expect(SearchRanker.distanceToSimilarity(3)).toBe(0.25);
    expect(SearchRanker.distanceToSimilarity(Number.NaN)).toBe(0);

    expect(SearchRanker.excludeNoteId([{ noteId: 'a' }, { noteId: 'b' }], 'a')).toEqual([
      { noteId: 'b' },
    ]);
    expect(SearchRanker.applyLimit([1, 2, 3], 2)).toEqual([1, 2]);
    expect(
      SearchRanker.filterByDateRange(
        [
          { at: new Date('2026-04-20T00:00:00') },
          { at: new Date('2026-04-22T00:00:00') },
        ],
        (item) => item.at,
        new Date('2026-04-20T00:00:00'),
        new Date('2026-04-21T23:59:59'),
      ),
    ).toEqual([{ at: new Date('2026-04-20T00:00:00') }]);
    expect(SearchRanker.paginate(['a', 'b', 'c'], 1, 1)).toEqual(['b']);
  });
});
