/**
 * IEchoCanceller — remove acoustic echo (speaker bleed) from a mic recording.
 *
 * When a meeting is recorded on speakers, the other participants come out of
 * the speakers and the mic picks up a reverberant copy of them, contaminating
 * the "You" track. We capture the system audio digitally (the clean reference),
 * so an echo canceller can subtract it from the mic — the same approach Granola
 * and the AEC challenges use. Runs offline on the recorded tracks before
 * transcription; the implementation is best-effort and the caller falls back to
 * the raw mic if cancellation is unavailable.
 */

export interface CancelEchoRequest {
  /** Absolute path to the near-end (mic) WAV — 16 kHz mono PCM. */
  micPath: string;
  /** Absolute path to the far-end reference (system) WAV — 16 kHz mono PCM. */
  referencePath: string;
  /** Absolute path to write the echo-cancelled mic WAV. */
  outputPath: string;
}

export interface IEchoCanceller {
  isReady(): boolean;
  initialize(): Promise<void>;
  /** Write an echo-cancelled copy of the mic to `outputPath`. */
  cancel(request: CancelEchoRequest): Promise<void>;
}
