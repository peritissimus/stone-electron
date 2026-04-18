import { EVENTS } from '@shared/constants/ipcChannels';
import {
  NoteEntity,
  type NoteProps,
  type INoteRepository,
  type ITogglePinUseCase,
  NoteNotFoundError,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';

export class TogglePinUseCase implements ITogglePinUseCase {
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
    note.togglePinned();
    await this.noteRepository.save(note);

    this.eventPublisher?.emit(EVENTS.NOTE_UPDATED, { id: request.id });

    return { note: note.toPersistence() };
  }
}
