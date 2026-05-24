import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IIndexRepository } from '../../../domain/ports/out/IIndexRepository';
import type {
  IFindSimilarNotesUseCase,
  FindSimilarNotesRequest,
  FindSimilarNotesResponse,
} from '../../../domain/ports/in/ISearchUseCases';

export class FindSimilarNotesUseCase implements IFindSimilarNotesUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly indexRepository: IIndexRepository,
  ) {}

  async execute(request: FindSimilarNotesRequest): Promise<FindSimilarNotesResponse> {
    const noteVec = await this.indexRepository.getNoteVector(request.noteId);
    if (!noteVec) return { results: [] };

    const note = await this.noteRepository.findById(request.noteId);
    if (!note) return { results: [] };

    const similar = await this.indexRepository.findSimilarNotesByVector(noteVec, {
      limit: request.limit || 5,
      workspaceId: note.workspaceId || undefined,
      excludeNoteId: request.noteId,
    });

    return {
      results: similar.map((s) => ({
        noteId: s.noteId,
        title: s.title,
        distance: s.similarity,
      })),
    };
  }
}
