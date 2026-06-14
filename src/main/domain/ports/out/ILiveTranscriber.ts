/**
 * ILiveTranscriber — low-latency streaming transcription for the live draft
 * shown while a meeting is being recorded.
 *
 * Backed by a resident whisper model (the batch ITranscriber spawns a fresh
 * process per call, which reloads the model — fine for one final pass, fatal
 * for per-chunk live). The implementation keeps the model loaded and transcribes
 * short audio chunks as they stream in. This is the *draft*: the accurate,
 * echo-cancelled per-source transcript is still produced by the batch pipeline
 * at finalize (Option B — fast raw live preview, clean final).
 */

import type { TranscriptSegment } from '../../entities';

export interface LiveChunkResult {
  /** Plain text for the chunk. */
  text: string;
  /** Chunk-relative segments (startMs/endMs from the chunk start). */
  segments: TranscriptSegment[];
}

export interface ILiveTranscriber {
  isReady(): boolean;
  /** Spawn the resident model server and wait until it can serve requests. */
  start(): Promise<void>;
  /** Shut the server down and free the model from memory. */
  stop(): Promise<void>;
  /** Transcribe one 16 kHz mono WAV chunk. */
  transcribeChunk(wav: Uint8Array): Promise<LiveChunkResult>;
}
