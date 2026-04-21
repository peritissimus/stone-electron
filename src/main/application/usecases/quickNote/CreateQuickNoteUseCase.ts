import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { QuickNoteSlot } from '../../../domain/ports/in/IQuickNoteUseCases';
import type { QuickNoteSlotFolders } from '@shared/types/settings';
import { CreateNoteUseCase } from '../note/CreateNoteUseCase';

function resolveSlotFolder(folders: QuickNoteSlotFolders, slot: QuickNoteSlot): string {
  switch (slot) {
    case 'personal':
      return folders.personal;
    case 'work':
      return folders.work;
    default: {
      const exhaustive: never = slot;
      throw new Error(`Unknown quick-note slot: ${exhaustive}`);
    }
  }
}

function defaultQuickNoteTitle(): string {
  const now = new Date();
  return `Untitled Note ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
}

export class CreateQuickNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: {
    slot: QuickNoteSlot;
    title?: string;
    workspaceId?: string;
  }): Promise<{ noteId: string }> {
    const config = await this.appConfigRepository.get();
    const folderPath = resolveSlotFolder(
      config.notes.locationPolicy.quickNoteSlotFolders,
      request.slot,
    );

    // Reuse CreateNoteUseCase so the existing folder/path/event logic applies
    // uniformly — no separate write path to drift from.
    const createNote = new CreateNoteUseCase(
      this.noteRepository,
      this.workspaceRepository,
      this.fileStorage,
      this.appConfigRepository,
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
