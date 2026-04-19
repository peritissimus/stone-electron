import type { ITopicRepository } from '../../../domain/ports/out/ITopicRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { IAssignTopicToNoteUseCase } from '../../../domain/ports/in/ITopicUseCases';
import { EVENTS } from '@shared/constants/ipcChannels';
import { logger } from '../../../shared/utils';

export class AssignTopicToNoteUseCase implements IAssignTopicToNoteUseCase {
  constructor(
    private readonly topicRepository: ITopicRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(noteId: string, topicId: string): Promise<void> {
    await this.topicRepository.assignToNote(noteId, topicId, {
      confidence: 1.0,
      isManual: true,
    });
    this.eventPublisher?.emit(EVENTS.NOTE_CLASSIFIED, {
      noteId,
      topicId,
      confidence: 1.0,
      isManual: true,
    });
    logger.info(`[TopicUseCases] Assigned topic ${topicId} to note ${noteId}`);
  }
}
