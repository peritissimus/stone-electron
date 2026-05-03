import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { ITopicRepository } from '../../../domain/ports/out/ITopicRepository';
import type { IRecomputeCentroidsUseCase } from '../../../domain/ports/in/ITopicUseCases';
import { SimilarityCalculator } from '../../../domain/services/SimilarityCalculator';

export class RecomputeCentroidsUseCase implements IRecomputeCentroidsUseCase {
  constructor(
    private readonly topicRepository: ITopicRepository,
    private readonly noteRepository: INoteRepository,
  ) {}

  async execute(): Promise<void> {
    const topics = await this.topicRepository.findAll();

    for (const topicProps of topics) {
      const notesForTopic = await this.topicRepository.getNotesForTopic(topicProps.id);
      const noteIds = notesForTopic.map((n) => n.noteId);
      const embeddings: number[][] = [];

      for (const noteId of noteIds) {
        const embedding = await this.noteRepository.getEmbedding(noteId);
        if (embedding) embeddings.push(embedding);
      }

      if (embeddings.length > 0) {
        const centroid = SimilarityCalculator.calculateCentroid(embeddings);
        await this.topicRepository.updateCentroid(
          topicProps.id,
          new Uint8Array(new Float32Array(centroid).buffer),
        );
      }
    }
  }
}
