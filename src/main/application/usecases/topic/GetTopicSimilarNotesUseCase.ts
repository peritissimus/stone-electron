import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IIndexRepository } from '../../../domain/ports/out/IIndexRepository';
import type {
  IGetTopicSimilarNotesUseCase,
  TopicSimilarNote,
} from '../../../domain/ports/in/ITopicUseCases';

export class GetTopicSimilarNotesUseCase implements IGetTopicSimilarNotesUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly indexRepository: IIndexRepository,
  ) {}

  async execute(noteId: string, limit: number = 10): Promise<TopicSimilarNote[]> {
    const note = await this.noteRepository.findById(noteId);
    if (!note) return [];

    const embedding = await this.indexRepository.getNoteVector(noteId);
    if (!embedding) return [];

    const similar = await this.indexRepository.findSimilarNotesByVector(embedding, {
      limit,
      workspaceId: note.workspaceId || undefined,
      excludeNoteId: noteId,
    });

    return similar.map((s) => ({
      noteId: s.noteId,
      title: s.title,
      distance: s.similarity, // legacy field name carries cosine similarity
    }));
  }
}
