import { describe, expect, it } from 'vitest';
import {
  buildSummaryTranscript,
  buildTranscriptText,
  LOW_CONFIDENCE_TAG,
} from '../../../../src/main/domain/services/transcriptFormat';
import type { TranscriptSegment } from '../../../../src/main/domain/entities';

const seg = (
  text: string,
  source: 'mic' | 'system',
  confidence?: number,
): TranscriptSegment => ({ text, startMs: 0, endMs: 1000, source, confidence });

describe('buildTranscriptText', () => {
  it('labels each line by speaker without any confidence markers', () => {
    const out = buildTranscriptText([
      seg('hello', 'mic', 0.3),
      seg('hi there', 'system', 0.95),
    ]);
    expect(out).toBe('You: hello\nOthers: hi there');
    expect(out).not.toContain(LOW_CONFIDENCE_TAG);
  });
});

describe('buildSummaryTranscript', () => {
  it('tags only lines below the confidence threshold', () => {
    const out = buildSummaryTranscript([
      seg('clear speech', 'mic', 0.92),
      seg('mumbled bit', 'system', 0.41),
    ]);
    expect(out).toBe(`You: clear speech\nOthers ${LOW_CONFIDENCE_TAG}: mumbled bit`);
  });

  it('is identical to the clean text when no segment has a confidence score', () => {
    const segments = [seg('a', 'mic'), seg('b', 'system')];
    expect(buildSummaryTranscript(segments)).toBe(buildTranscriptText(segments));
  });
});
