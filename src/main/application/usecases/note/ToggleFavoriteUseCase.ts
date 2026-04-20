import {
  NoteEntity,
  type NoteProps,
  type INoteRepository,
  type IToggleFavoriteUseCase,
  NoteNotFoundError,
  DOMAIN_EVENT_TYPES,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';

export class ToggleFavoriteUseCase implements IToggleFavoriteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { id: string }): Promise<{ note: NoteProps }> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    const note = NoteEntity.fromPersistence(noteProps);
    note.toggleFavorite();
    await this.noteRepository.save(note);

    this.eventPublisher?.publish({
      type: DOMAIN_EVENT_TYPES.NOTE_UPDATED,
      timestamp: new Date(),
      payload: { id: request.id },
    });

    return { note: note.toPersistence() };
  }
}
