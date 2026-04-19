import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IEmbedder } from '../../../domain/ports/out/IEmbedder';
import type {
  ISemanticSearchUseCase,
  SemanticSearchRequest,
  SemanticSearchResponse,
} from '../../../domain/ports/in/ISearchUseCases';

export class SemanticSearchUseCase implements ISemanticSearchUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly embedder: IEmbedder,
  ) {}

  async execute(request: SemanticSearchRequest): Promise<SemanticSearchResponse> {
    // Generate embedding for query
    const queryEmbedding = await this.embedder.generateEmbedding(request.query);

    if (!queryEmbedding) {
      return { results: [] };
    }

    // Convert Float32Array to number[]
    const embeddingArray = Array.from(queryEmbedding);

    // Find similar notes
    const results = await this.noteRepository.findBySimilarity(
      embeddingArray,
      request.limit || 10,
      request.workspaceId,
    );

    return { results };
  }
}
