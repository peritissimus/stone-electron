import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IEmbedder } from '../../../domain/ports/out/IEmbedder';
import type {
  IFindSimilarNotesUseCase,
  FindSimilarNotesRequest,
  FindSimilarNotesResponse,
} from '../../../domain/ports/in/ISearchUseCases';

export class FindSimilarNotesUseCase implements IFindSimilarNotesUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly embedder: IEmbedder,
  ) {}

  async execute(request: FindSimilarNotesRequest): Promise<FindSimilarNotesResponse> {
    // Get note's embedding
    const embedding = await this.noteRepository.getEmbedding(request.noteId);

    if (!embedding) {
      return { results: [] };
    }

    // Get note to find its workspace
    const note = await this.noteRepository.findById(request.noteId);
    if (!note) {
      return { results: [] };
    }

    // Find similar notes (excluding the source note)
    const allResults = await this.noteRepository.findBySimilarity(
      embedding,
      (request.limit || 5) + 1,
      note.workspaceId || undefined,
    );

    const results = allResults
      .filter((r) => r.noteId !== request.noteId)
      .slice(0, request.limit || 5);

    return { results };
  }
}
