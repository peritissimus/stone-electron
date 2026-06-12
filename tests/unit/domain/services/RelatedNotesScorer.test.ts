/**
 * RelatedNotesScorer Domain Service Tests
 *
 * Pure scoring tests over synthetic vectors — no mocks needed. Vectors are
 * generated with a seeded LCG so every run is deterministic.
 */

import { describe, it, expect } from 'vitest';
import {
  RelatedNotesScorer,
  type AlignableChunk,
} from '../../../../src/main/domain/services/RelatedNotesScorer';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function randomVector(rand: () => number, dims: number): number[] {
  return Array.from({ length: dims }, () => rand() - 0.5);
}

function addNoise(base: number[], rand: () => number, scale: number): number[] {
  return base.map((v) => v + (rand() - 0.5) * scale);
}

let chunkSeq = 0;
function chunk(noteId: string, embedding: number[] | null): AlignableChunk {
  chunkSeq += 1;
  return { id: `chunk-${chunkSeq}`, noteId, embedding };
}

describe('RelatedNotesScorer', () => {
  describe('scoreCandidates — fallback band (small corpus)', () => {
    // Below the calibration floors the scorer uses raw cosines with the
    // fixed 0.35–0.85 band, which makes hand-built vectors predictable.
    const e1 = [1, 0, 0, 0];
    const e2 = [0, 1, 0, 0];

    it('returns empty for missing embeddings', () => {
      expect(
        RelatedNotesScorer.scoreCandidates([chunk('src', null)], [chunk('a', e1)]),
      ).toEqual([]);
      expect(
        RelatedNotesScorer.scoreCandidates([chunk('src', e1)], [chunk('a', null)]),
      ).toEqual([]);
    });

    it('scores near-duplicates ≈ 1 and orthogonal noise ≈ 0', () => {
      const results = RelatedNotesScorer.scoreCandidates(
        [chunk('src', e1)],
        [chunk('dup', [0.99, 0.01, 0, 0]), chunk('noise', e2)],
      );

      const dup = results.find((r) => r.noteId === 'dup')!;
      const noise = results.find((r) => r.noteId === 'noise')!;
      expect(dup.semanticScore).toBeGreaterThan(0.9);
      expect(noise.semanticScore).toBe(0);
      expect(results[0].noteId).toBe('dup');
    });

    it('matches a multi-topic source through its individual topics', () => {
      // Source covers two orthogonal topics; the candidate matches only
      // topic B. A centroid query would blur both topics to cos ≈ 0.7,
      // chunk alignment keeps the full-strength match.
      const results = RelatedNotesScorer.scoreCandidates(
        [chunk('src', e1), chunk('src', e2)],
        [chunk('topicB', [0, 0.98, 0.02, 0])],
      );
      expect(results[0].semanticScore).toBeGreaterThan(0.9);
    });

    it('reports the best-aligned chunk and the strong-chunk count', () => {
      const strong = chunk('a', [0.97, 0.03, 0, 0]);
      const weak = chunk('a', [0.6, 0.8, 0, 0]);
      const results = RelatedNotesScorer.scoreCandidates([chunk('src', e1)], [weak, strong]);

      expect(results[0].bestChunk.id).toBe(strong.id);
      expect(results[0].strongChunks).toBeGreaterThanOrEqual(1);
    });

    it('gives a focused note more breadth bonus than a long note with the same best match', () => {
      const aligned = [0.8, 0.6, 0, 0]; // cos 0.8 vs source
      const offTopic = [0, 0.1, 0.99, 0];

      const focused = Array.from({ length: 4 }, () => chunk('focused', aligned));
      const journal = [
        ...Array.from({ length: 4 }, () => chunk('journal', aligned)),
        ...Array.from({ length: 36 }, () => chunk('journal', offTopic)),
      ];

      const results = RelatedNotesScorer.scoreCandidates(
        [chunk('src', e1)],
        [...focused, ...journal],
      );
      const focusedScore = results.find((r) => r.noteId === 'focused')!.semanticScore;
      const journalScore = results.find((r) => r.noteId === 'journal')!.semanticScore;
      expect(focusedScore).toBeGreaterThan(journalScore);
    });
  });

  describe('scoreCandidates — corpus-calibrated mode', () => {
    it('separates a near-duplicate from corpus noise after centering', () => {
      const rand = lcg(42);
      const dims = 32;

      const sourceChunks = Array.from({ length: 4 }, () =>
        chunk('src', randomVector(rand, dims)),
      );

      const candidates: AlignableChunk[] = [];
      // Near-duplicate of the source note.
      for (const c of sourceChunks) {
        candidates.push(chunk('dup', addNoise(c.embedding!, rand, 0.05)));
      }
      // 20 unrelated notes × 4 chunks — enough to trigger calibration.
      for (let n = 0; n < 20; n += 1) {
        for (let k = 0; k < 4; k += 1) {
          candidates.push(chunk(`noise-${n}`, randomVector(rand, dims)));
        }
      }

      const results = RelatedNotesScorer.scoreCandidates(sourceChunks, candidates);

      expect(results[0].noteId).toBe('dup');
      expect(results[0].semanticScore).toBeGreaterThan(0.7);
      for (const r of results.filter((x) => x.noteId !== 'dup')) {
        expect(r.semanticScore).toBeLessThan(0.4);
      }
    });

    it('ranks a topically-aligned note above noise even with a shared corpus bias', () => {
      const rand = lcg(7);
      const dims = 32;
      // Every vector shares a strong common direction — the anisotropy
      // cone. Without centering, all cosines would be inflated together.
      const bias = randomVector(rand, dims).map((v) => v * 4);

      const topic = randomVector(rand, dims);
      const sourceChunks = Array.from({ length: 4 }, () =>
        chunk('src', addNoise([...bias], rand, 0.4).map((v, i) => v + topic[i])),
      );

      const candidates: AlignableChunk[] = [];
      for (let k = 0; k < 4; k += 1) {
        candidates.push(
          chunk('related', addNoise([...bias], rand, 0.4).map((v, i) => v + topic[i])),
        );
      }
      for (let n = 0; n < 20; n += 1) {
        const other = randomVector(rand, dims);
        for (let k = 0; k < 4; k += 1) {
          candidates.push(
            chunk(`noise-${n}`, addNoise([...bias], rand, 0.4).map((v, i) => v + other[i])),
          );
        }
      }

      const results = RelatedNotesScorer.scoreCandidates(sourceChunks, candidates);
      expect(results[0].noteId).toBe('related');
      const related = results.find((r) => r.noteId === 'related')!;
      const bestNoise = results.find((r) => r.noteId !== 'related')!;
      expect(related.semanticScore).toBeGreaterThan(bestNoise.semanticScore);
    });
  });

  describe('tagJaccard', () => {
    it('is 0 with no overlap or empty sets', () => {
      expect(RelatedNotesScorer.tagJaccard(new Set(['a']), new Set(['b']))).toBe(0);
      expect(RelatedNotesScorer.tagJaccard(new Set(), new Set(['b']))).toBe(0);
    });

    it('is intersection over union', () => {
      expect(
        RelatedNotesScorer.tagJaccard(new Set(['a', 'b']), new Set(['b', 'c'])),
      ).toBeCloseTo(1 / 3, 5);
      expect(
        RelatedNotesScorer.tagJaccard(new Set(['a', 'b']), new Set(['a', 'b'])),
      ).toBe(1);
    });
  });

  describe('graphOverlap', () => {
    it('weights common neighbors by inverse log degree (hub discount)', () => {
      const degrees = new Map([
        ['hub', 100],
        ['niche', 2],
      ]);
      const degreeOf = (id: string) => degrees.get(id) ?? 0;

      const viaHub = RelatedNotesScorer.graphOverlap(
        new Set(['hub']),
        new Set(['hub']),
        degreeOf,
        false,
      );
      const viaNiche = RelatedNotesScorer.graphOverlap(
        new Set(['niche']),
        new Set(['niche']),
        degreeOf,
        false,
      );

      // Identical sets normalize to 1 either way, so compare mixed sets.
      const mixedHub = RelatedNotesScorer.graphOverlap(
        new Set(['hub', 'x']),
        new Set(['hub', 'y']),
        (id) => (id === 'hub' ? 100 : 2),
        false,
      );
      const mixedNiche = RelatedNotesScorer.graphOverlap(
        new Set(['niche', 'x']),
        new Set(['niche', 'y']),
        (id) => (id === 'niche' ? 2 : 2),
        false,
      );
      expect(mixedNiche).toBeGreaterThan(mixedHub);
      expect(viaHub).toBeCloseTo(1, 5);
      expect(viaNiche).toBeCloseTo(1, 5);
    });

    it('is 0 without shared neighbors and ≥ 0.5 for direct links', () => {
      const degreeOf = () => 2;
      expect(
        RelatedNotesScorer.graphOverlap(new Set(['a']), new Set(['b']), degreeOf, false),
      ).toBe(0);
      expect(
        RelatedNotesScorer.graphOverlap(new Set(['a']), new Set(['b']), degreeOf, true),
      ).toBe(0.5);
      expect(
        RelatedNotesScorer.graphOverlap(new Set(), new Set(), degreeOf, true),
      ).toBe(0.5);
    });
  });

  describe('finalScore', () => {
    const noSignals = {
      tagJaccard: 0,
      graphOverlap: 0,
      lexicalStrength: 0,
      sameNotebook: false,
      isJournal: false,
    };

    it('passes the semantic score through without signals', () => {
      expect(RelatedNotesScorer.finalScore(0.5, noSignals)).toBe(0.5);
    });

    it('adds bounded structural boosts and caps at 1', () => {
      const boosted = RelatedNotesScorer.finalScore(0.5, {
        ...noSignals,
        tagJaccard: 1,
        graphOverlap: 1,
        lexicalStrength: 1,
        sameNotebook: true,
      });
      expect(boosted).toBeCloseTo(0.5 + 0.12 + 0.1 + 0.1 + 0.03, 5);
      expect(
        RelatedNotesScorer.finalScore(0.95, { ...noSignals, tagJaccard: 1 }),
      ).toBe(1);
    });

    it('demotes journal notes multiplicatively', () => {
      const journal = RelatedNotesScorer.finalScore(0.5, { ...noSignals, isJournal: true });
      expect(journal).toBeCloseTo(0.4, 5);
    });
  });

  describe('distinctiveTerms', () => {
    it('ranks rare terms above corpus-common ones and drops stopwords', () => {
      const source = [
        'The kubernetes cluster restarts because the project deadline is near',
        'kubernetes ingress misroutes traffic',
      ];
      const corpus = [
        'project planning for the quarter',
        'project retrospective notes',
        'the project roadmap and milestones',
      ];

      const terms = RelatedNotesScorer.distinctiveTerms(source, corpus, 5);
      expect(terms[0]).toBe('kubernetes');
      expect(terms).not.toContain('the');
      expect(terms.indexOf('kubernetes')).toBeLessThan(
        terms.includes('project') ? terms.indexOf('project') : terms.length,
      );
    });

    it('returns empty for empty input', () => {
      expect(RelatedNotesScorer.distinctiveTerms([], [], 5)).toEqual([]);
      expect(RelatedNotesScorer.distinctiveTerms(['the and for'], [], 5)).toEqual([]);
    });
  });
});
