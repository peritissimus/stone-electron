import type { IEmbedder } from '../../../domain/ports/out/IEmbedder';
import type { IInitializeTopicsUseCase } from '../../../domain/ports/in/ITopicUseCases';
import { logger } from '../../../shared/utils';

export class InitializeTopicsUseCase implements IInitializeTopicsUseCase {
  constructor(private readonly embedder: IEmbedder) {}

  async execute(): Promise<{ success: boolean; ready: boolean }> {
    try {
      await this.embedder.initialize();
      const ready = this.embedder.isReady();
      logger.info('[TopicUseCases] Embedding service initialized, ready:', ready);
      return { success: true, ready };
    } catch (error) {
      logger.error('[TopicUseCases] Failed to initialize embedding service:', error);
      return { success: false, ready: false };
    }
  }
}
