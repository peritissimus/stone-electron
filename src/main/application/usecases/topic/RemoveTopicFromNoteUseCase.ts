import type { ITopicRepository } from '../../../domain/ports/out/ITopicRepository';
import {
  DOMAIN_EVENT_TYPES,
  type IEventPublisher,
} from '../../../domain/ports/out/IEventPublisher';
import type { IRemoveTopicFromNoteUseCase } from '../../../domain/ports/in/ITopicUseCases';

export class RemoveTopicFromNoteUseCase implements IRemoveTopicFromNoteUseCase {
  constructor(
    private readonly topicRepository: ITopicRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(noteId: string, topicId: string): Promise<void> {
    await this.topicRepository.removeFromNote(noteId, topicId);
    this.eventPublisher?.publish({
      type: DOMAIN_EVENT_TYPES.NOTE_CLASSIFIED,
      timestamp: new Date(),
      payload: {
        noteId,
        topicId: null,
        removed: true,
      },
    });
  }
}
