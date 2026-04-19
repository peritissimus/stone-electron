import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { ITopicRepository } from '../../../domain/ports/out/ITopicRepository';
import type {
  IGetNotesForTopicUseCase,
  NoteForTopic,
} from '../../../domain/ports/in/ITopicUseCases';

export class GetNotesForTopicUseCase implements IGetNotesForTopicUseCase {
  constructor(
    private readonly topicRepository: ITopicRepository,
    private readonly noteRepository: INoteRepository,
  ) {}

  async execute(
    topicId: string,
    options?: { limit?: number; offset?: number; excludeJournal?: boolean },
  ): Promise<NoteForTopic[]> {
    const notesForTopic = await this.topicRepository.getNotesForTopic(topicId, options);

    const results: NoteForTopic[] = [];
    for (const item of notesForTopic) {
      const note = await this.noteRepository.findById(item.noteId);
      if (note) {
        results.push({
          id: item.noteId,
          title: note.title || 'Untitled',
          confidence: item.confidence,
          isManual: item.isManual,
        });
      }
    }

    return results;
  }
}
