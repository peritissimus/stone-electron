import { describe, expect, it } from 'vitest';
import { collapseRepeatedSegments } from '../../../../src/main/domain/services/transcriptRepeats';
import type { TranscriptSegment } from '../../../../src/main/domain/entities';

const seg = (text: string, startMs: number, endMs: number): TranscriptSegment => ({
  text,
  startMs,
  endMs,
});

describe('collapseRepeatedSegments', () => {
  it('collapses a run of consecutive duplicates into one spanning segment', () => {
    const input = [
      seg('Hello there.', 0, 1000),
      seg('And they will go out of the race.', 1000, 2000),
      seg('And they will go out of the race.', 2000, 3000),
      seg('And they will go out of the race.', 3000, 4000),
      seg('Okay, got it.', 4000, 5000),
    ];
    const out = collapseRepeatedSegments(input);
    expect(out.map((s) => s.text)).toEqual([
      'Hello there.',
      'And they will go out of the race.',
      'Okay, got it.',
    ]);
    // The collapsed segment spans the whole run.
    expect(out[1]).toMatchObject({ startMs: 1000, endMs: 4000 });
  });

  it('ignores case / whitespace / trailing punctuation when matching', () => {
    const out = collapseRepeatedSegments([
      seg('Yes.', 0, 500),
      seg('yes', 500, 1000),
      seg('YES!', 1000, 1500),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ startMs: 0, endMs: 1500 });
  });

  it('preserves a phrase repeated non-consecutively (real speech)', () => {
    const out = collapseRepeatedSegments([
      seg('Right.', 0, 500),
      seg('We should ship it.', 500, 1500),
      seg('Right.', 1500, 2000),
    ]);
    expect(out).toHaveLength(3);
  });

  it('returns an empty array unchanged', () => {
    expect(collapseRepeatedSegments([])).toEqual([]);
  });

  it('keeps the most conservative confidence across a merged run', () => {
    const out = collapseRepeatedSegments([
      { text: 'um yeah', startMs: 0, endMs: 1000, confidence: 0.8 },
      { text: 'um yeah', startMs: 1000, endMs: 2000, confidence: 0.4 },
      { text: 'um yeah', startMs: 2000, endMs: 3000, confidence: 0.6 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].confidence).toBe(0.4);
    expect(out[0]).toMatchObject({ startMs: 0, endMs: 3000 });
  });
});
