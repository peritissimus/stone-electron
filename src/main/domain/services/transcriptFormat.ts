/**
 * Transcript formatting for storage, display, and summarization.
 *
 * Two renderings of the same speaker-labelled transcript:
 *   - buildTranscriptText   — clean "You:/Others:" lines (stored + displayed).
 *   - buildSummaryTranscript — a structured, one-line-per-segment format that
 *     hands the summarizer every signal we have: start timestamp, speaker,
 *     a confidence band, and a [repeated ×N] loop marker. The prompt knows how
 *     to read this format and compensate for known transcription failure modes.
 *
 * Pure domain code — no I/O.
 */

import type { TranscriptSegment } from '../entities';

export type ConfidenceBand = 'HIGH' | 'MED' | 'LOW';

/** Band cutoffs on whisper's mean per-token probability. LOW < 0.5 ≤ MED < 0.75 ≤ HIGH.
 *  Starting points — worth tuning against real transcript distributions. */
export const CONFIDENCE_MED_MIN = 0.5;
export const CONFIDENCE_HIGH_MIN = 0.75;

export function confidenceBand(probability: number): ConfidenceBand {
  if (probability >= CONFIDENCE_HIGH_MIN) return 'HIGH';
  if (probability >= CONFIDENCE_MED_MIN) return 'MED';
  return 'LOW';
}

function speakerLabel(segment: TranscriptSegment): string {
  return segment.source === 'system' ? 'Others' : 'You';
}

/** Elapsed time from the start of the recording: mm:ss, or h:mm:ss past an hour. */
function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Clean speaker-labelled transcript — the canonical stored/displayed text. */
export function buildTranscriptText(segments: TranscriptSegment[]): string {
  return segments.map((s) => `${speakerLabel(s)}: ${s.text}`).join('\n');
}

/**
 * Structured transcript for the summarizer. One line per segment:
 *
 *   [mm:ss] (Speaker) <BAND> [repeated ×N] text
 *
 * - <BAND> is omitted when the segment has no confidence (legacy transcripts).
 * - [repeated ×N] appears only when consecutive duplicates were collapsed.
 *
 * The prompt's INPUT FORMAT section must stay in sync with this shape.
 */
export function buildSummaryTranscript(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => {
      const parts = [`[${formatTimestamp(s.startMs)}]`, `(${speakerLabel(s)})`];
      if (typeof s.confidence === 'number') parts.push(`<${confidenceBand(s.confidence)}>`);
      if (typeof s.repeatCount === 'number' && s.repeatCount > 1) {
        parts.push(`[repeated ×${s.repeatCount}]`);
      }
      parts.push(s.text);
      return parts.join(' ');
    })
    .join('\n');
}
