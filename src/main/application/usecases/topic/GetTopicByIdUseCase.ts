import type { ITopicRepository } from '../../../domain/ports/out/ITopicRepository';
import type {
  IGetTopicByIdUseCase,
  TopicDTO,
} from '../../../domain/ports/in/ITopicUseCases';

export class GetTopicByIdUseCase implements IGetTopicByIdUseCase {
  constructor(private readonly topicRepository: ITopicRepository) {}

  async execute(id: string): Promise<TopicDTO | null> {
    const topic = await this.topicRepository.findById(id);
    if (!topic) return null;

    const notesForTopic = await this.topicRepository.getNotesForTopic(id);
    const noteCount = notesForTopic.length;

    return {
      id: topic.id,
      name: topic.name,
      description: topic.description,
      color: topic.color,
      isPredefined: topic.isPredefined,
      noteCount,
    };
  }
}
