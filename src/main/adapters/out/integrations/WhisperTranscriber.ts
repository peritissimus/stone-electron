/**
 * WhisperTranscriber — speech-to-text via the embedding worker.
 *
 * Mirrors the LocalReranker pattern: a worker-client interface lets the
 * adapter stay testable while the host EmbeddingWorker owns thread
 * management. Caller passes an absolute path to a 16kHz mono 16-bit WAV;
 * the use case is responsible for cleanup after success.
 */

import type {
  ITranscriber,
  TranscribeRequest,
  TranscribeResult,
} from '../../../domain';
import { logger } from '../../../shared/utils';

export interface TranscriberWorkerClient {
  isTranscriberReady(): boolean;
  initializeTranscriber(): Promise<void>;
  transcribe(audioPath: string): Promise<{
    text: string;
    segments: Array<{ text: string; startMs: number; endMs: number }>;
    durationMs: number;
  }>;
}

export interface WhisperTranscriberDeps {
  workerService: TranscriberWorkerClient;
}

export class WhisperTranscriber implements ITranscriber {
  constructor(private readonly deps: WhisperTranscriberDeps) {}

  isReady(): boolean {
    return this.deps.workerService.isTranscriberReady();
  }

  async initialize(): Promise<void> {
    if (this.deps.workerService.isTranscriberReady()) return;
    await this.deps.workerService.initializeTranscriber();
  }

  async transcribe(request: TranscribeRequest): Promise<TranscribeResult> {
    if (!this.isReady()) {
      try {
        await this.initialize();
      } catch (error) {
        logger.error('[WhisperTranscriber] failed to initialize', error);
        throw error;
      }
    }
    return this.deps.workerService.transcribe(request.audioPath);
  }
}
