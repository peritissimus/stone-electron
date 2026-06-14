/**
 * transcriptRepeats — collapse whisper's repetition-loop hallucinations.
 *
 * Even with VAD, whisper sometimes gets stuck repeating a phrase for many
 * consecutive segments on ambiguous or continuous audio (e.g. a phrase echoed
 * ~once per second for minutes). Consecutive segments with identical text are
 * virtually always that loop, not real speech, so we merge each run into a
 * single segment — keeping the text once and spanning the merged time range.
 *
 * Conservative on purpose: only *consecutive* duplicates are collapsed, so a
 * phrase legitimately said again later in the conversation is preserved.
 */

import type { TranscriptSegment } from '../entities';

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,!?…]+$/, '');
}

export function collapseRepeatedSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  for (const seg of segments) {
    const prev = out[out.length - 1];
    if (prev && normalize(prev.text) === normalize(seg.text)) {
      // Same phrase again back-to-back — extend the run instead of duplicating.
      prev.endMs = Math.max(prev.endMs, seg.endMs);
      prev.repeatCount = (prev.repeatCount ?? 1) + 1;
      // Keep the most conservative confidence across the merged run.
      if (typeof seg.confidence === 'number') {
        prev.confidence =
          typeof prev.confidence === 'number'
            ? Math.min(prev.confidence, seg.confidence)
            : seg.confidence;
      }
      continue;
    }
    out.push({ ...seg });
  }
  return out;
}
