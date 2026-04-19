import type { ITopicRepository } from '../../../domain/ports/out/ITopicRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type {
  IUpdateTopicUseCase,
  TopicDTO,
} from '../../../domain/ports/in/ITopicUseCases';
import { TopicEntity } from '../../../domain/entities/Topic';
import { EVENTS } from '@shared/constants/ipcChannels';

export class UpdateTopicUseCase implements IUpdateTopicUseCase {
  constructor(
    private readonly topicRepository: ITopicRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(
    id: string,
    data: { name?: string; description?: string; color?: string },
  ): Promise<TopicDTO> {
    const topicProps = await this.topicRepository.findById(id);
    if (!topicProps) {
      throw new Error(`Topic not found: ${id}`);
    }

    const topic = TopicEntity.fromPersistence(topicProps);
    if (data.name) topic.rename(data.name);
    if (data.description !== undefined) topic.updateDescription(data.description);
    if (data.color) topic.changeColor(data.color);

    await this.topicRepository.save(topic);
    this.eventPublisher?.emit(EVENTS.TOPIC_UPDATED, { topic: topic.toPersistence() });

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
