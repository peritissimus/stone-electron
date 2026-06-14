import { describe, expect, it } from 'vitest';
import {
  buildSummaryTranscript,
  buildTranscriptText,
  confidenceBand,
} from '../../../../src/main/domain/services/transcriptFormat';
import type { TranscriptSegment } from '../../../../src/main/domain/entities';

const seg = (over: Partial<TranscriptSegment>): TranscriptSegment => ({
  text: 'hello',
  startMs: 0,
  endMs: 1000,
  source: 'mic',
  ...over,
});

describe('confidenceBand', () => {
  it('buckets on the 0.5 / 0.75 cutoffs', () => {
    expect(confidenceBand(0.95)).toBe('HIGH');
    expect(confidenceBand(0.75)).toBe('HIGH');
    expect(confidenceBand(0.74)).toBe('MED');
    expect(confidenceBand(0.5)).toBe('MED');
    expect(confidenceBand(0.49)).toBe('LOW');
    expect(confidenceBand(0)).toBe('LOW');
  });
});

describe('buildTranscriptText', () => {
  it('labels each line by speaker, with no metadata', () => {
    const out = buildTranscriptText([
      seg({ text: 'hello', source: 'mic', confidence: 0.3, repeatCount: 4 }),
      seg({ text: 'hi there', source: 'system', confidence: 0.95 }),
    ]);
    expect(out).toBe('You: hello\nOthers: hi there');
  });
});

describe('buildSummaryTranscript', () => {
  it('renders timestamp, speaker, confidence band, and repeat marker', () => {
    const out = buildSummaryTranscript([
      seg({ text: 'clear point', startMs: 65_000, source: 'mic', confidence: 0.92 }),
      seg({
        text: 'sell it in a terminal',
        startMs: 70_000,
        source: 'system',
        confidence: 0.4,
        repeatCount: 24,
      }),
    ]);
    expect(out).toBe(
      '[01:05] (You) <HIGH> clear point\n' +
        '[01:10] (Others) <LOW> [repeated ×24] sell it in a terminal',
    );
  });

  it('omits the band when a segment has no confidence (legacy)', () => {
    const out = buildSummaryTranscript([seg({ text: 'a', startMs: 0, source: 'mic' })]);
    expect(out).toBe('[00:00] (You) a');
  });

  it('uses h:mm:ss past an hour', () => {
    const out = buildSummaryTranscript([
      seg({ text: 'late', startMs: 3_725_000, source: 'mic', confidence: 0.8 }),
    ]);
    expect(out).toBe('[1:02:05] (You) <HIGH> late');
  });
});
