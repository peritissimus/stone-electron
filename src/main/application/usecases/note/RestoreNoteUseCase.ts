import { EVENTS } from '@shared/constants/ipcChannels';
import {
  NoteEntity,
  type INoteRepository,
  type IRestoreNoteUseCase,
  NoteNotFoundError,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';

export class RestoreNoteUseCase implements IRestoreNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { id: string }): Promise<void> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    const note = NoteEntity.fromPersistence(noteProps);
    note.restore();
    await this.noteRepository.save(note);

    this.eventPublisher?.emit(EVENTS.NOTE_UPDATED, { id: request.id });
  }
}
