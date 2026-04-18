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

    // Get all markdown files in workspace
    const markdownFiles = await this.fileStorage.glob('**/*.md', workspace.folderPath);

    // Get existing notes for this workspace
    const existingNotes = await this.noteRepository.findAll({ workspaceId: workspace.id });
    const existingPathsMap = new Map(existingNotes.map((n) => [n.filePath, n]));
    const foundPaths = new Set<string>();

    let created = 0;
    let updated = 0;
    let deleted = 0;
    const errors: string[] = [];

    // Process each file
    for (const relativePath of markdownFiles) {
      foundPaths.add(relativePath);
      const absolutePath = path.join(workspace.folderPath, relativePath);
      const fileInfo = await this.fileStorage.getFileInfo(absolutePath);

      if (!fileInfo) continue;

      const existingNote = existingPathsMap.get(relativePath);

      if (!existingNote) {
        // Create new note entry
        const fileContent = await this.fileStorage.read(absolutePath);

        // Extract title from content or derive from filename
        let title = fileContent ? this.markdownProcessor.extractTitle(fileContent) : null;
        if (!title) {
          title = path.basename(relativePath, '.md');
        }

        const note = NoteEntity.create({
          id: generateId(),
          title,
          filePath: relativePath,
          workspaceId: workspace.id,
        });

        await this.noteRepository.save(note);
        this.eventPublisher?.emit(EVENTS.NOTE_CREATED, { id: note.id });

        created++;
      } else if (existingNote.updatedAt < fileInfo.modifiedAt) {
        // Note was modified externally - update timestamp
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
    }

    // Mark deleted notes (soft delete)
    for (const note of existingNotes) {
      if (note.filePath && !foundPaths.has(note.filePath) && !note.isDeleted) {
        const noteEntity = NoteEntity.fromPersistence(note);
        noteEntity.delete();

        await this.noteRepository.save(noteEntity);
        this.eventPublisher?.emit(EVENTS.NOTE_DELETED, { id: note.id });

        deleted++;
      }
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
