import type { ITopicRepository } from '../../../domain/ports/out/ITopicRepository';
import type {
  IGetAllTopicsUseCase,
  TopicDTO,
} from '../../../domain/ports/in/ITopicUseCases';

export class GetAllTopicsUseCase implements IGetAllTopicsUseCase {
  constructor(private readonly topicRepository: ITopicRepository) {}

  async execute(): Promise<TopicDTO[]> {
    const topicsWithCounts = await this.topicRepository.findAllWithCounts();
    return topicsWithCounts.map((topic) => ({
      id: topic.id,
      name: topic.name,
      description: topic.description,
      color: topic.color,
      isPredefined: topic.isPredefined,
      noteCount: topic.noteCount,
    }));
  }
}
