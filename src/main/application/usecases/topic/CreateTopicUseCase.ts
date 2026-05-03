import type { ITopicRepository } from '../../../domain/ports/out/ITopicRepository';
import type { IIdGenerator } from '../../../domain/ports/out/IIdGenerator';
import {
  DOMAIN_EVENT_TYPES,
  type IEventPublisher,
} from '../../../domain/ports/out/IEventPublisher';
import type {
  ICreateTopicUseCase,
  TopicDTO,
} from '../../../domain/ports/in/ITopicUseCases';
import { TopicEntity } from '../../../domain/entities/Topic';

export class CreateTopicUseCase implements ICreateTopicUseCase {
  constructor(
    private readonly topicRepository: ITopicRepository,
    private readonly idGenerator: IIdGenerator,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(data: {
    name: string;
    description?: string;
    color?: string;
  }): Promise<TopicDTO> {
    const topic = TopicEntity.create({
      id: this.idGenerator.generate(),
      name: data.name,
      description: data.description || '',
      color: data.color || '#6366f1',
      isPredefined: false,
    });

    await this.topicRepository.save(topic);
    this.eventPublisher?.publish({
      type: DOMAIN_EVENT_TYPES.TOPIC_CREATED,
      timestamp: new Date(),
      payload: { topic: topic.toPersistence() },
    });

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
