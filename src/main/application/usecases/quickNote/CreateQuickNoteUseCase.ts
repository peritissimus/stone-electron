import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { QuickNoteSlot } from '../../../domain/ports/in/IQuickNoteUseCases';
import { CreateNoteUseCase } from '../note/CreateNoteUseCase';

/**
 * Slot → folder mapping. Lives on the backend so the renderer doesn't need
 * to know what folders back each slot. Keep as a plain constant for now;
 * promote to AppConfig if/when users need to rename the targets.
 */
const SLOT_FOLDERS: Record<QuickNoteSlot, string> = {
  personal: 'Personal',
  work: 'Work',
};

function defaultQuickNoteTitle(): string {
  const now = new Date();
  return `Untitled Note ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
}

export class CreateQuickNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: {
    slot: QuickNoteSlot;
    title?: string;
    workspaceId?: string;
  }): Promise<{ noteId: string }> {
    const folderPath = SLOT_FOLDERS[request.slot];
    if (!folderPath) {
      throw new Error(`Unknown quick-note slot: ${request.slot}`);
    }

    // Reuse CreateNoteUseCase so the existing folder/path/event logic applies
    // uniformly — no separate write path to drift from.
    const createNote = new CreateNoteUseCase(
      this.noteRepository,
      this.workspaceRepository,
      this.fileStorage,
      this.eventPublisher,
    );

    const { note } = await createNote.execute({
      title: request.title ?? defaultQuickNoteTitle(),
      content: '',
      folderPath,
      workspaceId: request.workspaceId,
    });

    return { noteId: note.id };
  }
}
