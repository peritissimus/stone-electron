/**
 * ITranscriber — speech-to-text over a recorded audio file.
 *
 * Local implementation runs Xenova/whisper-* in the embedding worker;
 * a cloud variant could later implement the same port. The use case
 * owns audio cleanup; transcriber just reads the file.
 */

import type { TranscriptSegment } from '../../entities';

export interface TranscribeRequest {
  /** Absolute path to an audio file (webm/wav/mp3 — Whisper handles them). */
  audioPath: string;
  /** Optional progress callback fired by the implementation per chunk. */
  onProgress?: (info: TranscribeProgress) => void;
}

export interface TranscribeProgress {
  /** 0-1 fraction; -1 if the implementation can't estimate. */
  fraction: number;
  message?: string;
}

export interface TranscribeResult {
  text: string;
  segments: TranscriptSegment[];
  /** Duration of the audio in ms, as reported by the decoder. */
  durationMs: number;
}

export interface ITranscriber {
  isReady(): boolean;
  initialize(): Promise<void>;
  transcribe(request: TranscribeRequest): Promise<TranscribeResult>;
}
