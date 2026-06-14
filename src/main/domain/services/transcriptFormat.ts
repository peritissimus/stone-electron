/**
 * Transcript formatting for storage, display, and summarization.
 *
 * Two renderings of the same speaker-labelled transcript:
 *   - buildTranscriptText  — clean "You:/Others:" lines (stored + displayed).
 *   - buildSummaryTranscript — same, but flags low-confidence lines so the
 *     summarizer can treat shaky transcription cautiously instead of stating
 *     it as fact.
 *
 * Pure domain code — no I/O.
 */

import type { TranscriptSegment } from '../entities';

/**
 * Lines whose whisper confidence is below this are tagged for the summarizer.
 * 0.6 mean per-token probability is a practical "the model wasn't sure" line —
 * clearly-decoded speech sits well above it.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

/** Inline marker appended to a speaker label on uncertain lines. */
export const LOW_CONFIDENCE_TAG = '⟨low confidence⟩';

function speakerLabel(segment: TranscriptSegment): string {
  return segment.source === 'system' ? 'Others' : 'You';
}

/** Clean speaker-labelled transcript — the canonical stored/displayed text. */
export function buildTranscriptText(segments: TranscriptSegment[]): string {
  return segments.map((s) => `${speakerLabel(s)}: ${s.text}`).join('\n');
}

/**
 * Speaker-labelled transcript for the summarizer, with low-confidence lines
 * tagged so the LLM can discount uncertain transcription. Identical to
 * buildTranscriptText when no segment carries a confidence score (legacy
 * transcripts), so it's a safe drop-in.
 */
export function buildSummaryTranscript(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => {
      const uncertain =
        typeof s.confidence === 'number' && s.confidence < LOW_CONFIDENCE_THRESHOLD;
      const label = uncertain ? `${speakerLabel(s)} ${LOW_CONFIDENCE_TAG}` : speakerLabel(s);
      return `${label}: ${s.text}`;
    })
    .join('\n');
}
