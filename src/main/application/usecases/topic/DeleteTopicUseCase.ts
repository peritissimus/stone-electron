import type { ITopicRepository } from '../../../domain/ports/out/ITopicRepository';
import {
  DOMAIN_EVENT_TYPES,
  type IEventPublisher,
} from '../../../domain/ports/out/IEventPublisher';
import type { IDeleteTopicUseCase } from '../../../domain/ports/in/ITopicUseCases';

export class DeleteTopicUseCase implements IDeleteTopicUseCase {
  constructor(
    private readonly topicRepository: ITopicRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(id: string): Promise<void> {
    const topic = await this.topicRepository.findById(id);
    if (!topic) {
      throw new Error(`Topic not found: ${id}`);
    }
    if (topic.isPredefined) {
      throw new Error('Cannot delete predefined topics');
    }

    await this.topicRepository.delete(id);
    this.eventPublisher?.publish({
      type: DOMAIN_EVENT_TYPES.TOPIC_DELETED,
      timestamp: new Date(),
      payload: { id },
    });
  }
}
