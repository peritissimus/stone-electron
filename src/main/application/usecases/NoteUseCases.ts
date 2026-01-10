/**
 * Note Use Cases
 *
 * Application layer implementations for note operations.
 * Orchestrates domain entities, repositories, and services.
 */

import { generateId } from '@shared/utils/id';
import path from 'node:path';
import { EVENTS } from '@shared/constants/ipcChannels';
import {
  NoteEntity,
  type NoteProps,
  type INoteRepository,
  type IFileStorage,
  type IMarkdownProcessor,
  type INoteUseCases,
  type ICreateNoteUseCase,
  type IUpdateNoteUseCase,
  type IGetNoteUseCase,
  type IListNotesUseCase,
  type IDeleteNoteUseCase,
  type IRestoreNoteUseCase,
  type IMoveNoteUseCase,
  type ISearchNotesUseCase,
  type IGetNoteContentUseCase,
  type ISaveNoteContentUseCase,
  type IGetNoteByPathUseCase,
  type IToggleFavoriteUseCase,
  type ITogglePinUseCase,
  type IToggleArchiveUseCase,
  NoteNotFoundError,
} from '../../domain';
import type { IEventPublisher } from '../../domain/ports/out/IEventPublisher';
import type { IWorkspaceRepository } from '../../domain/ports/out/IWorkspaceRepository';

// ============================================================================
// Use Case Implementations
// ============================================================================

export class CreateNoteUseCase implements ICreateNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly markdownProcessor: IMarkdownProcessor,
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

    // Get active workspace for file path resolution
    const workspace = await this.workspaceRepository.findActive();
    if (!workspace) {
      throw new Error('No active workspace');
    }

    // Create domain entity with workspace
    const note = NoteEntity.create({
      id,
      title: request.title,
      notebookId: request.notebookId,
      workspaceId: request.workspaceId || workspace.id,
    });

    // Determine folder path (default to 'Personal' like legacy)
    const folderPath = request.folderPath || 'Personal';

    // Generate filename based on folder type
    let filename: string;
    if (folderPath === 'Journal' && request.title) {
      // For journals, use title as filename (e.g., "2026-01-11.md")
      filename = `${request.title}.md`;
    } else {
      // Generate timestamp-based filename like legacy: YYYY-MM-DD-HHMMSS-RRR.md
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

    // Construct relative path: folderPath/filename.md
    const relativePath = `${folderPath}/${filename}`;
    note.updateFilePath(relativePath);

    // Construct absolute path for file operations
    const absolutePath = path.join(workspace.folderPath, relativePath);

    // Write initial content to file
    const content = request.content || '';
    const markdown = this.markdownProcessor.htmlToMarkdown(content);
    await this.fileStorage.write(absolutePath, markdown);

    // Save to repository
    await this.noteRepository.save(note);

    // Publish event
    this.eventPublisher?.emit(EVENTS.NOTE_CREATED, { id: note.id });

    return { note: note.toPersistence() };
  }
}

export class UpdateNoteUseCase implements IUpdateNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly markdownProcessor: IMarkdownProcessor,
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

    // Update content if provided
    if (request.content !== undefined && note.filePath) {
      // Get workspace for file path resolution
      const workspaceId = note.workspaceId || (await this.workspaceRepository.findActive())?.id;
      const workspace = workspaceId ? await this.workspaceRepository.findById(workspaceId) : null;

      if (!workspace) {
        throw new Error('Workspace not found for note');
      }

      const absolutePath = path.join(workspace.folderPath, note.filePath);
      const bodyMarkdown = this.markdownProcessor.htmlToMarkdown(request.content);

      // Prepend title heading - the editor only contains body content
      const titleHeading = `# ${note.title}\n\n`;
      const fullMarkdown = titleHeading + bodyMarkdown;

      await this.fileStorage.write(absolutePath, fullMarkdown);
    }

    await this.noteRepository.save(note);

    // Publish event
    this.eventPublisher?.emit(EVENTS.NOTE_UPDATED, { id: note.id });

    return { note: note.toPersistence() };
  }
}

export class GetNoteUseCase implements IGetNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly markdownProcessor: IMarkdownProcessor,
  ) {}

  async execute(request: {
    id: string;
    includeContent?: boolean;
  }): Promise<{ note: NoteProps; content?: string }> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    let content: string | undefined;
    if (request.includeContent && noteProps.filePath) {
      // Get workspace for file path resolution
      const workspaceId =
        noteProps.workspaceId || (await this.workspaceRepository.findActive())?.id;
      const workspace = workspaceId ? await this.workspaceRepository.findById(workspaceId) : null;

      if (workspace) {
        const absolutePath = path.join(workspace.folderPath, noteProps.filePath);
        const exists = await this.fileStorage.exists(absolutePath);
        if (exists) {
          const markdown = await this.fileStorage.read(absolutePath);
          if (markdown) {
            content = await this.markdownProcessor.markdownToHtml(markdown);
          }
        }
      }
    }

    return { note: noteProps, content };
  }
}

export class ListNotesUseCase implements IListNotesUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
  ) {}

  async execute(request: {
    workspaceId?: string;
    notebookId?: string | null;
    filter?: 'all' | 'favorites' | 'pinned' | 'archived' | 'trash';
    limit?: number;
    offset?: number;
    orderBy?: 'createdAt' | 'updatedAt' | 'title';
    orderDirection?: 'asc' | 'desc';
  }): Promise<{ notes: NoteProps[]; total: number }> {
    // Use active workspace if workspaceId not provided
    const workspaceId = request.workspaceId || (await this.workspaceRepository.findActive())?.id;
    const filter = request.filter || 'all';

    let notes: NoteProps[];
    let total: number;

    switch (filter) {
      case 'favorites':
        notes = await this.noteRepository.findFavorites(workspaceId);
        total = notes.length;
        break;
      case 'pinned':
        notes = await this.noteRepository.findPinned(workspaceId);
        total = notes.length;
        break;
      case 'archived':
        notes = await this.noteRepository.findArchived(workspaceId);
        total = notes.length;
        break;
      case 'trash':
        notes = await this.noteRepository.findDeleted(workspaceId);
        total = notes.length;
        break;
      default:
        notes = await this.noteRepository.findAll({
          workspaceId: workspaceId,
          notebookId: request.notebookId,
          isDeleted: false,
          limit: request.limit,
          offset: request.offset,
          orderBy: request.orderBy,
          orderDirection: request.orderDirection,
        });
        total = await this.noteRepository.count({
          workspaceId: workspaceId,
          notebookId: request.notebookId,
          isDeleted: false,
        });
    }

    return { notes, total };
  }
}

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
      // Permanent delete - remove file and database record
      if (noteProps.filePath) {
        // Get workspace for file path resolution
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
      // Soft delete
      const note = NoteEntity.fromPersistence(noteProps);
      note.delete();
      await this.noteRepository.save(note);
    }

    // Publish event
    this.eventPublisher?.emit(EVENTS.NOTE_DELETED, { id: request.id });
  }
}

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

    // Publish event (restored = updated)
    this.eventPublisher?.emit(EVENTS.NOTE_UPDATED, { id: request.id });
  }
}

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

    // Publish event
    this.eventPublisher?.emit(EVENTS.NOTE_UPDATED, { id: request.id });
  }
}

export class SearchNotesUseCase implements ISearchNotesUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
  ) {}

  async execute(request: {
    query: string;
    workspaceId?: string;
    limit?: number;
  }): Promise<{ notes: NoteProps[]; total: number }> {
    const workspaceId = request.workspaceId || (await this.workspaceRepository.findActive())?.id;
    const notes = await this.noteRepository.searchByTitle({
      query: request.query,
      workspaceId,
      limit: request.limit,
    });

    return { notes, total: notes.length };
  }
}

export class GetNoteContentUseCase implements IGetNoteContentUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly markdownProcessor: IMarkdownProcessor,
  ) {}

  async execute(request: { id: string }): Promise<{ content: string }> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    if (!noteProps.filePath) {
      return { content: '' };
    }

    // Get workspace for file path resolution
    const workspaceId = noteProps.workspaceId || (await this.workspaceRepository.findActive())?.id;
    const workspace = workspaceId ? await this.workspaceRepository.findById(workspaceId) : null;

    if (!workspace) {
      return { content: '' };
    }

    const absolutePath = path.join(workspace.folderPath, noteProps.filePath);
    const exists = await this.fileStorage.exists(absolutePath);
    if (!exists) {
      return { content: '' };
    }

    const markdown = await this.fileStorage.read(absolutePath);
    if (!markdown) {
      return { content: '' };
    }

    // Strip the first H1 heading from markdown since title is edited separately
    const bodyMarkdown = this.stripFirstHeading(markdown);
    const html = await this.markdownProcessor.markdownToHtml(bodyMarkdown);

    return { content: html };
  }

  /**
   * Strip the first H1 heading from markdown content.
   * The title is edited separately in the title editor.
   */
  private stripFirstHeading(markdown: string): string {
    const lines = markdown.split('\n');
    let foundHeading = false;
    const result: string[] = [];

    for (const line of lines) {
      // Match H1 heading: # Title
      if (!foundHeading && /^#\s+.+$/.test(line)) {
        foundHeading = true;
        // Skip this line (the title heading)
        // Also skip the next line if it's empty (common pattern: # Title\n\n)
        continue;
      }
      result.push(line);
    }

    // Remove leading empty lines that may result from stripping the heading
    while (result.length > 0 && result[0].trim() === '') {
      result.shift();
    }

    return result.join('\n');
  }
}

export class SaveNoteContentUseCase implements ISaveNoteContentUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly markdownProcessor: IMarkdownProcessor,
  ) {}

  async execute(request: { id: string; content: string }): Promise<void> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    if (!noteProps.filePath) {
      throw new Error('Note has no file path');
    }

    // Get workspace for file path resolution
    const workspaceId = noteProps.workspaceId || (await this.workspaceRepository.findActive())?.id;
    const workspace = workspaceId ? await this.workspaceRepository.findById(workspaceId) : null;

    if (!workspace) {
      throw new Error('Workspace not found for note');
    }

    const absolutePath = path.join(workspace.folderPath, noteProps.filePath);
    const bodyMarkdown = this.markdownProcessor.htmlToMarkdown(request.content);

    // Prepend title heading - the editor only contains body content
    const titleHeading = `# ${noteProps.title}\n\n`;
    const fullMarkdown = titleHeading + bodyMarkdown;

    await this.fileStorage.write(absolutePath, fullMarkdown);
  }
}

export class GetNoteByPathUseCase implements IGetNoteByPathUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly markdownProcessor: IMarkdownProcessor,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { filePath: string; workspaceId?: string }): Promise<{ note: NoteProps }> {
    const workspace = request.workspaceId
      ? await this.workspaceRepository.findById(request.workspaceId)
      : await this.workspaceRepository.findActive();

    const workspaceId = workspace?.id;

    // First try to find in database
    const noteProps = await this.noteRepository.findByFilePath(request.filePath, workspaceId);
    if (noteProps) {
      return { note: noteProps };
    }

    // Not in database - check if file exists on disk
    if (!workspace) {
      throw new NoteNotFoundError(`file:${request.filePath} (workspace:${workspaceId})`);
    }

    const absolutePath = path.join(workspace.folderPath, request.filePath);
    const fileExists = await this.fileStorage.exists(absolutePath);

    if (!fileExists) {
      throw new NoteNotFoundError(`file:${request.filePath} (workspace:${workspaceId})`);
    }

    // File exists on disk but not in DB - create the note entry
    const fileContent = await this.fileStorage.read(absolutePath);
    const filenameWithoutExt = path.basename(request.filePath, '.md');

    // For journal files, always use the filename as title (e.g., "2026-01-11")
    // This matches how journals are created in useJournalActions
    const isJournalFile = request.filePath.startsWith('Journal/');
    let title: string;

    if (isJournalFile) {
      // Journal titles are the date filename format
      title = filenameWithoutExt;
    } else {
      // For other files, try to extract title from content, fallback to filename
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
    this.eventPublisher?.emit(EVENTS.NOTE_CREATED, { id: note.id });

    return { note: note.toPersistence() };
  }
}

export class ToggleFavoriteUseCase implements IToggleFavoriteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { id: string }): Promise<{ note: NoteProps }> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    const note = NoteEntity.fromPersistence(noteProps);
    note.toggleFavorite();
    await this.noteRepository.save(note);

    this.eventPublisher?.emit(EVENTS.NOTE_UPDATED, { id: request.id });

    return { note: note.toPersistence() };
  }
}

export class TogglePinUseCase implements ITogglePinUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { id: string }): Promise<{ note: NoteProps }> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    const note = NoteEntity.fromPersistence(noteProps);
    note.togglePinned();
    await this.noteRepository.save(note);

    this.eventPublisher?.emit(EVENTS.NOTE_UPDATED, { id: request.id });

    return { note: note.toPersistence() };
  }
}

export class ToggleArchiveUseCase implements IToggleArchiveUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { id: string }): Promise<{ note: NoteProps }> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    const note = NoteEntity.fromPersistence(noteProps);
    note.setArchived(!noteProps.isArchived);
    await this.noteRepository.save(note);

    this.eventPublisher?.emit(EVENTS.NOTE_UPDATED, { id: request.id });

    return { note: note.toPersistence() };
  }
}

// ============================================================================
// Factory
// ============================================================================

export interface NoteUseCasesDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
  markdownProcessor: IMarkdownProcessor;
  eventPublisher?: IEventPublisher;
}

export function createNoteUseCases(deps: NoteUseCasesDeps): INoteUseCases {
  const { noteRepository, workspaceRepository, fileStorage, markdownProcessor, eventPublisher } =
    deps;

  return {
    createNote: new CreateNoteUseCase(
      noteRepository,
      workspaceRepository,
      fileStorage,
      markdownProcessor,
      eventPublisher,
    ),
    updateNote: new UpdateNoteUseCase(
      noteRepository,
      workspaceRepository,
      fileStorage,
      markdownProcessor,
      eventPublisher,
    ),
    getNote: new GetNoteUseCase(
      noteRepository,
      workspaceRepository,
      fileStorage,
      markdownProcessor,
    ),
    listNotes: new ListNotesUseCase(noteRepository, workspaceRepository),
    deleteNote: new DeleteNoteUseCase(
      noteRepository,
      workspaceRepository,
      fileStorage,
      eventPublisher,
    ),
    restoreNote: new RestoreNoteUseCase(noteRepository, eventPublisher),
    moveNote: new MoveNoteUseCase(noteRepository, eventPublisher),
    searchNotes: new SearchNotesUseCase(noteRepository, workspaceRepository),
    getNoteContent: new GetNoteContentUseCase(
      noteRepository,
      workspaceRepository,
      fileStorage,
      markdownProcessor,
    ),
    saveNoteContent: new SaveNoteContentUseCase(
      noteRepository,
      workspaceRepository,
      fileStorage,
      markdownProcessor,
    ),
    getNoteByPath: new GetNoteByPathUseCase(
      noteRepository,
      workspaceRepository,
      fileStorage,
      markdownProcessor,
      eventPublisher,
    ),
    toggleFavorite: new ToggleFavoriteUseCase(noteRepository, eventPublisher),
    togglePin: new TogglePinUseCase(noteRepository, eventPublisher),
    toggleArchive: new ToggleArchiveUseCase(noteRepository, eventPublisher),
  };
}
