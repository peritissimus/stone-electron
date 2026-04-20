import path from 'node:path';
import {
  NoteEntity,
  type INoteRepository,
  type IFileStorage,
  type IDeleteNoteUseCase,
  NoteNotFoundError,
  DOMAIN_EVENT_TYPES,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';

export class DeleteNoteUseCase implements IDeleteNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { id: string; permanent?: boolean }): Promise<void> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    if (request.permanent) {
      if (noteProps.filePath) {
        const workspaceId =
          noteProps.workspaceId || (await this.workspaceRepository.findActive())?.id;
        const workspace = workspaceId ? await this.workspaceRepository.findById(workspaceId) : null;

        if (workspace) {
          const absolutePath = path.join(workspace.folderPath, noteProps.filePath);
          const exists = await this.fileStorage.exists(absolutePath);
          if (exists) {
            await this.fileStorage.delete(absolutePath);
          }
        }
      }
      await this.noteRepository.delete(request.id);
    } else {
      const note = NoteEntity.fromPersistence(noteProps);
      note.delete();
      await this.noteRepository.save(note);
    }

    this.eventPublisher?.publish({
      type: DOMAIN_EVENT_TYPES.NOTE_DELETED,
      timestamp: new Date(),
      payload: { id: request.id },
    });
  }
}
