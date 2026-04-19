import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type {
  IGetTopicSimilarNotesUseCase,
  TopicSimilarNote,
} from '../../../domain/ports/in/ITopicUseCases';

export class GetTopicSimilarNotesUseCase implements IGetTopicSimilarNotesUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(noteId: string, limit: number = 10): Promise<TopicSimilarNote[]> {
    const note = await this.noteRepository.findById(noteId);
    if (!note) return [];

    const embedding = await this.noteRepository.getEmbedding(noteId);
    if (!embedding) return [];

    const similarNotes = await this.noteRepository.findBySimilarity(
      embedding,
      limit + 1,
      note.workspaceId || undefined,
    );

    const results: TopicSimilarNote[] = [];
    for (const result of similarNotes) {
      if (result.noteId !== noteId) {
        const other = await this.noteRepository.findById(result.noteId);
        if (other) {
          results.push({
            noteId: result.noteId,
            title: other.title || 'Untitled',
            distance: result.distance,
          });
        }
      }
    }

    return results.slice(0, limit);
  }
}
