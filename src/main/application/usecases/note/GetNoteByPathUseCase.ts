import path from 'node:path';
import { generateId } from '@shared/utils/id';
import {
  NoteEntity,
  type NoteProps,
  type INoteRepository,
  type IFileStorage,
  type IMarkdownProcessor,
  type IAppConfigRepository,
  type IGetNoteByPathUseCase,
  NoteNotFoundError,
  DOMAIN_EVENT_TYPES,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';

export class GetNoteByPathUseCase implements IGetNoteByPathUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly markdownProcessor: IMarkdownProcessor,
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { filePath: string; workspaceId?: string }): Promise<{ note: NoteProps }> {
    const workspace = request.workspaceId
      ? await this.workspaceRepository.findById(request.workspaceId)
      : await this.workspaceRepository.findActive();

    const workspaceId = workspace?.id;

    const noteProps = await this.noteRepository.findByFilePath(request.filePath, workspaceId);
    if (noteProps) {
      return { note: noteProps };
    }

    if (!workspace) {
      throw new NoteNotFoundError(`file:${request.filePath} (workspace:${workspaceId})`);
    }

    const absolutePath = path.join(workspace.folderPath, request.filePath);
    const fileExists = await this.fileStorage.exists(absolutePath);

    if (!fileExists) {
      throw new NoteNotFoundError(`file:${request.filePath} (workspace:${workspaceId})`);
    }

    const fileContent = await this.fileStorage.read(absolutePath);
    const filenameWithoutExt = path.basename(request.filePath, '.md');

    const config = await this.appConfigRepository.get();
    const journalFolder = config.notes.locationPolicy.journalFolder;
    const isJournalFile = request.filePath.startsWith(`${journalFolder}/`);
    let title: string;

    if (isJournalFile) {
      title = filenameWithoutExt;
    } else {
      const extractedTitle = fileContent ? this.markdownProcessor.extractTitle(fileContent) : null;
      title = extractedTitle || filenameWithoutExt;
    }

    const note = NoteEntity.create({
      id: generateId(),
      title,
      filePath: request.filePath,
      workspaceId: workspace.id,
    });

    await this.noteRepository.save(note);
    this.eventPublisher?.publish({
      type: DOMAIN_EVENT_TYPES.NOTE_CREATED,
      timestamp: new Date(),
      payload: { id: note.id },
    });

    return { note: note.toPersistence() };
  }
}
