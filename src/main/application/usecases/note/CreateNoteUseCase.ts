import path from 'node:path';
import { generateId } from '@shared/utils/id';
import {
  NoteEntity,
  type NoteProps,
  type INoteRepository,
  type IFileStorage,
  type IAppConfigRepository,
  type ICreateNoteUseCase,
  DOMAIN_EVENT_TYPES,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';

export class CreateNoteUseCase implements ICreateNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: {
    id?: string;
    title?: string;
    content?: string;
    folderPath?: string;
    notebookId?: string;
    workspaceId?: string;
  }): Promise<{ note: NoteProps }> {
    const id = request.id || generateId();

    const workspace = await this.workspaceRepository.findActive();
    if (!workspace) {
      throw new Error('No active workspace');
    }

    const config = await this.appConfigRepository.get();
    const policy = config.notes.locationPolicy;

    const note = NoteEntity.create({
      id,
      title: request.title,
      notebookId: request.notebookId,
      workspaceId: request.workspaceId || workspace.id,
    });

    const folderPath = request.folderPath || policy.defaultNoteFolder;

    let filename: string;
    if (folderPath === policy.journalFolder && request.title) {
      filename = `${request.title}.md`;
    } else {
      const now = new Date();
      const timestamp = now
        .toISOString()
        .slice(0, 19)
        .replace(/[-:T]/g, '')
        .replace(/(\d{8})(\d{6})/, '$1-$2');
      const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0');
      filename = `${timestamp}-${random}.md`;
    }

    const relativePath = `${folderPath}/${filename}`;
    note.updateFilePath(relativePath);

    const absolutePath = path.join(workspace.folderPath, relativePath);
    const content = request.content || '';
    await this.fileStorage.write(absolutePath, content);

    await this.noteRepository.save(note);

    this.eventPublisher?.publish({
      type: DOMAIN_EVENT_TYPES.NOTE_CREATED,
      timestamp: new Date(),
      payload: { id: note.id },
    });

    return { note: note.toPersistence() };
  }
}
