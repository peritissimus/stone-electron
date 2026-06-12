import type {
  IWarmUpTranscriberUseCase,
  WarmUpTranscriberResponse,
} from '../../../domain/ports/in/IAIUseCases';
import type { ITranscriber } from '../../../domain/ports/out/ITranscriber';

/**
 * Pre-download/load the Whisper model so the first real transcription
 * (meeting recorder, voice capture) doesn't pay the ~80 MB download.
 * Used by onboarding's "download local models" step; idempotent.
 */
export class WarmUpTranscriberUseCase implements IWarmUpTranscriberUseCase {
  constructor(private readonly transcriber: ITranscriber) {}

  async execute(): Promise<WarmUpTranscriberResponse> {
    try {
      if (!this.transcriber.isReady()) {
        await this.transcriber.initialize();
      }
      return { ready: this.transcriber.isReady() };
    } catch {
      return { ready: false };
    }
  }
}
