import type {
  ISuggestLinksUseCase,
  SuggestLinksRequest,
  SuggestLinksResponse,
} from '../../../domain/ports/in/IAIUseCases';
import type { INoteRepository, IIndexRepository } from '../../../domain';

const DEFAULT_LIMIT = 8;

export class SuggestLinksUseCase implements ISuggestLinksUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly indexRepository: IIndexRepository,
  ) {}

  async execute(request: SuggestLinksRequest): Promise<SuggestLinksResponse> {
    const noteVec = await this.indexRepository.getNoteVector(request.noteId);
    if (!noteVec) return { links: [] };

    const note = await this.noteRepository.findById(request.noteId);
    if (!note) return { links: [] };

    const similar = await this.indexRepository.findSimilarNotesByVector(noteVec, {
      limit: request.limit ?? DEFAULT_LIMIT,
      workspaceId: note.workspaceId || undefined,
      excludeNoteId: request.noteId,
    });

    return {
      links: similar.map((s) => ({
        noteId: s.noteId,
        title: s.title,
        reason: 'Semantically similar note',
        score: s.similarity,
      })),
    };
  }
}
