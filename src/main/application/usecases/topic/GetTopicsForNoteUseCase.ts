import type { ITopicRepository } from '../../../domain/ports/out/ITopicRepository';
import type {
  IGetTopicsForNoteUseCase,
  TopicForNote,
} from '../../../domain/ports/in/ITopicUseCases';

export class GetTopicsForNoteUseCase implements IGetTopicsForNoteUseCase {
  constructor(private readonly topicRepository: ITopicRepository) {}

  async execute(noteId: string): Promise<TopicForNote[]> {
    return this.topicRepository.getTopicsForNote(noteId);
  }
}
