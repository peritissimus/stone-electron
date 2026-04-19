import path from 'node:path';
import { generateId } from '@shared/utils/id';
import { EVENTS } from '@shared/constants/ipcChannels';
import {
  NoteEntity,
  type WorkspaceProps,
  type IWorkspaceRepository,
  type ISyncWorkspaceUseCase,
  type SyncWorkspaceRequest,
  type SyncWorkspaceResponse,
  WorkspaceNotFoundError,
} from '../../../domain';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { IMarkdownProcessor } from '../../../domain/ports/out/IMarkdownProcessor';
import {
  WorkspaceDiffer,
  type DbEntry,
  type FsEntry,
} from '../../../domain/services/WorkspaceDiffer';

export class SyncWorkspaceUseCase implements ISyncWorkspaceUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly noteRepository: INoteRepository,
    private readonly fileStorage: IFileStorage,
    private readonly markdownProcessor: IMarkdownProcessor,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request?: SyncWorkspaceRequest): Promise<SyncWorkspaceResponse> {
    let workspace: WorkspaceProps | null;
    if (request?.workspaceId) {
      workspace = await this.workspaceRepository.findById(request.workspaceId);
      if (!workspace) {
        throw new WorkspaceNotFoundError(request.workspaceId);
      }
    } else {
      workspace = await this.workspaceRepository.findActive();
      if (!workspace) {
        throw new Error('No active workspace');
      }
    }

    // Load filesystem state (what .md files exist on disk).
    const markdownFiles = await this.fileStorage.glob('**/*.md', workspace.folderPath);
    const fsEntries: FsEntry[] = [];
    for (const relativePath of markdownFiles) {
      const absolutePath = path.join(workspace.folderPath, relativePath);
      const fileInfo = await this.fileStorage.getFileInfo(absolutePath);
      if (!fileInfo) continue;
      fsEntries.push({ relativePath, modifiedAt: fileInfo.modifiedAt });
    }

    // Load database state (what notes the DB knows about for this workspace).
    const existingNotes = await this.noteRepository.findAll({ workspaceId: workspace.id });
    const existingById = new Map(existingNotes.map((n) => [n.id, n]));
    const dbEntries: DbEntry[] = existingNotes.map((n) => ({
      id: n.id,
      filePath: n.filePath,
      updatedAt: n.updatedAt,
      isDeleted: n.isDeleted,
    }));

    // Pure diff: classify entries into added / modified / unchanged / removed.
    const plan = WorkspaceDiffer.diff(fsEntries, dbEntries);

    let created = 0;
    let updated = 0;
    let deleted = 0;
    const errors: string[] = [];

    // Act on `added` — create new note rows.
    for (const entry of plan.added) {
      const absolutePath = path.join(workspace.folderPath, entry.relativePath);
      const fileContent = await this.fileStorage.read(absolutePath);

      // Extract title from content or derive from filename
      let title = fileContent ? this.markdownProcessor.extractTitle(fileContent) : null;
      if (!title) {
        title = path.basename(entry.relativePath, '.md');
      }

      const note = NoteEntity.create({
        id: generateId(),
        title,
        filePath: entry.relativePath,
        workspaceId: workspace.id,
      });

      await this.noteRepository.save(note);
      this.eventPublisher?.emit(EVENTS.NOTE_CREATED, { id: note.id });

      created++;
    }

    // Act on `modified` — refresh title and bump timestamp.
    for (const entry of plan.modified) {
      const existingNote = existingById.get(entry.dbId);
      if (!existingNote) continue;

      const absolutePath = path.join(workspace.folderPath, entry.relativePath);
      const noteEntity = NoteEntity.fromPersistence(existingNote);

      // Re-extract title in case it changed
      const fileContent = await this.fileStorage.read(absolutePath);
      if (fileContent) {
        const newTitle = this.markdownProcessor.extractTitle(fileContent);
        if (newTitle && newTitle !== existingNote.title) {
          noteEntity.updateTitle(newTitle);
        }
      }

      // Force update timestamp
      if (existingNote.filePath) {
        noteEntity.updateFilePath(existingNote.filePath);
      }

      await this.noteRepository.save(noteEntity);
      this.eventPublisher?.emit(EVENTS.NOTE_UPDATED, { id: existingNote.id });

      updated++;
    }

    // Act on `removed` — soft-delete notes whose files are gone.
    for (const entry of plan.removed) {
      const existingNote = existingById.get(entry.dbId);
      if (!existingNote) continue;

      const noteEntity = NoteEntity.fromPersistence(existingNote);
      noteEntity.delete();

      await this.noteRepository.save(noteEntity);
      this.eventPublisher?.emit(EVENTS.NOTE_DELETED, { id: existingNote.id });

      deleted++;
    }

    return {
      workspaceId: workspace.id,
      notebooks: {
        created: 0,
        updated: 0,
        errors: [],
      },
      notes: { created, updated, deleted, errors },
    };
  }
}
