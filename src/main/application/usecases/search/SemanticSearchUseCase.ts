import type { IEmbedder } from '../../../domain/ports/out/IEmbedder';
import type { IIndexRepository } from '../../../domain/ports/out/IIndexRepository';
import type {
  ISemanticSearchUseCase,
  SemanticSearchRequest,
  SemanticSearchResponse,
} from '../../../domain/ports/in/ISearchUseCases';

export class SemanticSearchUseCase implements ISemanticSearchUseCase {
  constructor(
    private readonly embedder: IEmbedder,
    private readonly indexRepository: IIndexRepository,
  ) {}

  async execute(request: SemanticSearchRequest): Promise<SemanticSearchResponse> {
    const queryEmbedding = await this.embedder.generateEmbedding(request.query);
    if (!queryEmbedding) {
      // Embedder failed or is uninitialized → no semantic results. (Observability
      // for this belongs in the embedder adapter, not this pure use case.)
      return { results: [] };
    }

    const similar = await this.indexRepository.findSimilarNotesByVector(
      Array.from(queryEmbedding),
      {
        limit: request.limit || 10,
        workspaceId: request.workspaceId,
      },
    );

    return {
      results: similar.map((s) => ({
        noteId: s.noteId,
        title: s.title,
        distance: s.similarity,
      })),
    };
  }
}
