import type { ITopicRepository } from '../../../domain/ports/out/ITopicRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { IDeleteTopicUseCase } from '../../../domain/ports/in/ITopicUseCases';
import { EVENTS } from '@shared/constants/ipcChannels';
import { logger } from '../../../shared/utils';

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
    this.eventPublisher?.emit(EVENTS.TOPIC_DELETED, { id });
    logger.info(`[TopicUseCases] Deleted topic ${id}`);
  }
}
