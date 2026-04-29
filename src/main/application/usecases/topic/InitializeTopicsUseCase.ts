import type { IEmbedder } from '../../../domain/ports/out/IEmbedder';
import type { ITopicRepository } from '../../../domain/ports/out/ITopicRepository';
import type { IInitializeTopicsUseCase } from '../../../domain/ports/in/ITopicUseCases';
import { logger } from '../../../shared/utils';

export class InitializeTopicsUseCase implements IInitializeTopicsUseCase {
  constructor(
    private readonly embedder: IEmbedder,
    private readonly topicRepository: ITopicRepository,
  ) {}

  async execute(): Promise<{ success: boolean; ready: boolean }> {
    try {
      await this.embedder.initialize();
      const ready = this.embedder.isReady();

      if (ready) {
        await this.seedMissingCentroids();
      }

      logger.info('[TopicUseCases] Embedding service initialized, ready:', ready);
      return { success: true, ready };
    } catch (error) {
      logger.error('[TopicUseCases] Failed to initialize embedding service:', error);
      return { success: false, ready: false };
    }
  }

  // Predefined topics are seeded with null centroids. Without a centroid, a
  // topic is filtered out of classification candidates, leaving every note
  // unassigned and every topic empty (chicken-and-egg: centroid recompute
  // needs assigned notes, classification needs centroids). Bootstrap each
  // empty centroid from the embedding of its name+description.
  private async seedMissingCentroids(): Promise<void> {
    const topics = await this.topicRepository.findAll();
    const seedable = topics.filter((t) => t.centroid === null);
    if (seedable.length === 0) return;

    const seedText = (t: (typeof seedable)[number]) =>
      t.description ? `${t.name}. ${t.description}` : t.name;

    const embeddings = await this.embedder.generateEmbeddings(seedable.map(seedText));
    for (let i = 0; i < seedable.length; i++) {
      const buf = embeddings[i].buffer.slice(
        embeddings[i].byteOffset,
        embeddings[i].byteOffset + embeddings[i].byteLength,
      );
      await this.topicRepository.updateCentroid(seedable[i].id, new Uint8Array(buf));
    }
    logger.info(`[TopicUseCases] Seeded centroids for ${seedable.length} topics`);
  }
}
