import {
  NoteEntity,
  type INoteRepository,
  type IMoveNoteUseCase,
  NoteNotFoundError,
  DOMAIN_EVENT_TYPES,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';

export class MoveNoteUseCase implements IMoveNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { id: string; targetNotebookId: string | null }): Promise<void> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    const note = NoteEntity.fromPersistence(noteProps);
    note.moveToNotebook(request.targetNotebookId);
    await this.noteRepository.save(note);

    this.eventPublisher?.publish({
      type: DOMAIN_EVENT_TYPES.NOTE_UPDATED,
      timestamp: new Date(),
      payload: { id: request.id },
    });
  }
}
