import {
  NoteEntity,
  type NoteProps,
  type INoteRepository,
  type IFileStorage,
  type IUpdateNoteUseCase,
  type IPathService,
  NoteNotFoundError,
  DOMAIN_EVENT_TYPES,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';

export class UpdateNoteUseCase implements IUpdateNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly pathService: IPathService,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: {
    id: string;
    title?: string;
    content?: string;
    notebookId?: string;
    isFavorite?: boolean;
    isPinned?: boolean;
    isArchived?: boolean;
  }): Promise<{ note: NoteProps }> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    const note = NoteEntity.fromPersistence(noteProps);

    if (request.title !== undefined) {
      note.updateTitle(request.title);
    }
    if (request.notebookId !== undefined) {
      note.moveToNotebook(request.notebookId);
    }
    if (request.isFavorite !== undefined) {
      note.setFavorite(request.isFavorite);
    }
    if (request.isPinned !== undefined) {
      note.setPinned(request.isPinned);
    }
    if (request.isArchived !== undefined) {
      note.setArchived(request.isArchived);
    }

    if (request.content !== undefined && note.filePath) {
      const workspaceId = note.workspaceId || (await this.workspaceRepository.findActive())?.id;
      const workspace = workspaceId ? await this.workspaceRepository.findById(workspaceId) : null;

      if (!workspace) {
        throw new Error('Workspace not found for note');
      }

      const absolutePath = this.pathService.join(workspace.folderPath, note.filePath);
      const bodyMarkdown = request.content;
      const titleHeading = `# ${note.title}\n\n`;
      const fullMarkdown = titleHeading + bodyMarkdown;

      await this.fileStorage.write(absolutePath, fullMarkdown);
    }

    await this.noteRepository.save(note);

    this.eventPublisher?.publish({
      type: DOMAIN_EVENT_TYPES.NOTE_UPDATED,
      timestamp: new Date(),
      payload: { id: note.id },
    });

    return { note: note.toPersistence() };
  }
}
