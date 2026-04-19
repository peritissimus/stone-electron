import type { ITopicRepository } from '../../../domain/ports/out/ITopicRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { IRemoveTopicFromNoteUseCase } from '../../../domain/ports/in/ITopicUseCases';
import { EVENTS } from '@shared/constants/ipcChannels';
import { logger } from '../../../shared/utils';

export class RemoveTopicFromNoteUseCase implements IRemoveTopicFromNoteUseCase {
  constructor(
    private readonly topicRepository: ITopicRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(noteId: string, topicId: string): Promise<void> {
    await this.topicRepository.removeFromNote(noteId, topicId);
    this.eventPublisher?.emit(EVENTS.NOTE_CLASSIFIED, {
      noteId,
      topicId: null,
      removed: true,
    });
    logger.info(`[TopicUseCases] Removed topic ${topicId} from note ${noteId}`);
  }
}
