import type { ITopicRepository } from '../../../domain/ports/out/ITopicRepository';
import type { IIndexRepository } from '../../../domain/ports/out/IIndexRepository';
import type { IRecomputeCentroidsUseCase } from '../../../domain/ports/in/ITopicUseCases';
import { SimilarityCalculator } from '../../../domain/services/SimilarityCalculator';

export class RecomputeCentroidsUseCase implements IRecomputeCentroidsUseCase {
  constructor(
    private readonly topicRepository: ITopicRepository,
    private readonly indexRepository: IIndexRepository,
  ) {}

  async execute(): Promise<void> {
    const topics = await this.topicRepository.findAll();

    for (const topicProps of topics) {
      const notesForTopic = await this.topicRepository.getNotesForTopic(topicProps.id);
      const embeddings: number[][] = [];

      // The centroid is the mean of member-note vectors; each note vector
      // is itself the mean of that note's chunk embeddings. Notes without
      // chunks (not yet indexed) contribute nothing.
      for (const { noteId } of notesForTopic) {
        const vec = await this.indexRepository.getNoteVector(noteId);
        if (vec) embeddings.push(vec);
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
