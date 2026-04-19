import crypto from 'node:crypto';
import type { ITopicRepository } from '../../../domain/ports/out/ITopicRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type {
  ICreateTopicUseCase,
  TopicDTO,
} from '../../../domain/ports/in/ITopicUseCases';
import { TopicEntity } from '../../../domain/entities/Topic';
import { EVENTS } from '@shared/constants/ipcChannels';

export class CreateTopicUseCase implements ICreateTopicUseCase {
  constructor(
    private readonly topicRepository: ITopicRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(data: {
    name: string;
    description?: string;
    color?: string;
  }): Promise<TopicDTO> {
    const topic = TopicEntity.create({
      id: crypto.randomUUID(),
      name: data.name,
      description: data.description || '',
      color: data.color || '#6366f1',
      isPredefined: false,
    });

    await this.topicRepository.save(topic);
    this.eventPublisher?.emit(EVENTS.TOPIC_CREATED, { topic: topic.toPersistence() });

    return {
      id: topic.id,
      name: topic.name,
      description: topic.description,
      color: topic.color,
      isPredefined: topic.isPredefined,
      noteCount: 0,
    };
  }
}
