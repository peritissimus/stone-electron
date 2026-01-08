/**
 * Note Use Cases
 *
 * Application layer implementations for note operations.
 * Orchestrates domain entities, repositories, and services.
 */

import { generateId } from '@shared/utils/id';
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

// ============================================================================
// Use Case Implementations
// ============================================================================

export class CreateNoteUseCase implements ICreateNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly fileStorage: IFileStorage,
    private readonly markdownProcessor: IMarkdownProcessor
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

    // Create domain entity
    const note = NoteEntity.create({
      id,
      title: request.title,
      notebookId: request.notebookId,
      workspaceId: request.workspaceId,
    });

    // Determine file path
    let filePath = request.folderPath;
    if (!filePath && request.workspaceId) {
      const sanitizedTitle = (request.title || 'Untitled')
        .replace(/[<>:"/\\|?*]/g, '')
        .trim();
      filePath = `${sanitizedTitle}.md`;
    }

    if (filePath) {
      note.updateFilePath(filePath);

      // Write initial content to file
      const content = request.content || '';
      const markdown = this.markdownProcessor.htmlToMarkdown(content);
      await this.fileStorage.write(filePath, markdown);
    }

    // Save to repository
    await this.noteRepository.save(note);

    return { note: note.toPersistence() };
  }
}

export class UpdateNoteUseCase implements IUpdateNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly fileStorage: IFileStorage,
    private readonly markdownProcessor: IMarkdownProcessor
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
      const markdown = this.markdownProcessor.htmlToMarkdown(request.content);
      await this.fileStorage.write(note.filePath, markdown);
    }

    await this.noteRepository.save(note);

    return { note: note.toPersistence() };
  }
}

export class GetNoteUseCase implements IGetNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly fileStorage: IFileStorage,
    private readonly markdownProcessor: IMarkdownProcessor
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
      const exists = await this.fileStorage.exists(noteProps.filePath);
      if (exists) {
        const markdown = await this.fileStorage.read(noteProps.filePath);
        content = await this.markdownProcessor.markdownToHtml(markdown);
      }
    }

    return { note: noteProps, content };
  }
}

export class ListNotesUseCase implements IListNotesUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(request: {
    workspaceId?: string;
    notebookId?: string | null;
    filter?: 'all' | 'favorites' | 'pinned' | 'archived' | 'trash';
    limit?: number;
    offset?: number;
    orderBy?: 'createdAt' | 'updatedAt' | 'title';
    orderDirection?: 'asc' | 'desc';
  }): Promise<{ notes: NoteProps[]; total: number }> {
    const filter = request.filter || 'all';

    let notes: NoteProps[];
    let total: number;

    switch (filter) {
      case 'favorites':
        notes = await this.noteRepository.findFavorites(request.workspaceId);
        total = notes.length;
        break;
      case 'pinned':
        notes = await this.noteRepository.findPinned(request.workspaceId);
        total = notes.length;
        break;
      case 'archived':
        notes = await this.noteRepository.findArchived(request.workspaceId);
        total = notes.length;
        break;
      case 'trash':
        notes = await this.noteRepository.findDeleted(request.workspaceId);
        total = notes.length;
        break;
      default:
        notes = await this.noteRepository.findAll({
          workspaceId: request.workspaceId,
          notebookId: request.notebookId,
          isDeleted: false,
          limit: request.limit,
          offset: request.offset,
          orderBy: request.orderBy,
          orderDirection: request.orderDirection,
        });
        total = await this.noteRepository.count({
          workspaceId: request.workspaceId,
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
    private readonly fileStorage: IFileStorage
  ) {}

  async execute(request: { id: string; permanent?: boolean }): Promise<void> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    if (request.permanent) {
      // Permanent delete - remove file and database record
      if (noteProps.filePath) {
        const exists = await this.fileStorage.exists(noteProps.filePath);
        if (exists) {
          await this.fileStorage.delete(noteProps.filePath);
        }
      }
      await this.noteRepository.delete(request.id);
    } else {
      // Soft delete
      const note = NoteEntity.fromPersistence(noteProps);
      note.delete();
      await this.noteRepository.save(note);
    }
  }
}

export class RestoreNoteUseCase implements IRestoreNoteUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(request: { id: string }): Promise<void> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    const note = NoteEntity.fromPersistence(noteProps);
    note.restore();
    await this.noteRepository.save(note);
  }
}

export class MoveNoteUseCase implements IMoveNoteUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(request: { id: string; targetNotebookId: string | null }): Promise<void> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    const note = NoteEntity.fromPersistence(noteProps);
    note.moveToNotebook(request.targetNotebookId);
    await this.noteRepository.save(note);
  }
}

export class SearchNotesUseCase implements ISearchNotesUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(request: {
    query: string;
    workspaceId?: string;
    limit?: number;
  }): Promise<{ notes: NoteProps[]; total: number }> {
    const notes = await this.noteRepository.searchByTitle({
      query: request.query,
      workspaceId: request.workspaceId,
      limit: request.limit,
    });

    return { notes, total: notes.length };
  }
}

export class GetNoteContentUseCase implements IGetNoteContentUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly fileStorage: IFileStorage,
    private readonly markdownProcessor: IMarkdownProcessor
  ) {}

  async execute(request: { id: string }): Promise<{ content: string }> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    if (!noteProps.filePath) {
      return { content: '' };
    }

    const exists = await this.fileStorage.exists(noteProps.filePath);
    if (!exists) {
      return { content: '' };
    }

    const markdown = await this.fileStorage.read(noteProps.filePath);
    const html = await this.markdownProcessor.markdownToHtml(markdown);

    return { content: html };
  }
}

export class SaveNoteContentUseCase implements ISaveNoteContentUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly fileStorage: IFileStorage,
    private readonly markdownProcessor: IMarkdownProcessor
  ) {}

  async execute(request: { id: string; content: string }): Promise<void> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    if (!noteProps.filePath) {
      throw new Error('Note has no file path');
    }

    const markdown = this.markdownProcessor.htmlToMarkdown(request.content);
    await this.fileStorage.write(noteProps.filePath, markdown);
  }
}

export class GetNoteByPathUseCase implements IGetNoteByPathUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(request: { filePath: string }): Promise<{ note: NoteProps }> {
    const noteProps = await this.noteRepository.findByFilePath(request.filePath);
    if (!noteProps) {
      throw new NoteNotFoundError(`file:${request.filePath}`);
    }

    return { note: noteProps };
  }
}

export class ToggleFavoriteUseCase implements IToggleFavoriteUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(request: { id: string }): Promise<{ note: NoteProps }> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    const note = NoteEntity.fromPersistence(noteProps);
    note.toggleFavorite();
    await this.noteRepository.save(note);

    return { note: note.toPersistence() };
  }
}

export class TogglePinUseCase implements ITogglePinUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(request: { id: string }): Promise<{ note: NoteProps }> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    const note = NoteEntity.fromPersistence(noteProps);
    note.togglePinned();
    await this.noteRepository.save(note);

    return { note: note.toPersistence() };
  }
}

export class ToggleArchiveUseCase implements IToggleArchiveUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(request: { id: string }): Promise<{ note: NoteProps }> {
    const noteProps = await this.noteRepository.findById(request.id);
    if (!noteProps) {
      throw new NoteNotFoundError(request.id);
    }

    const note = NoteEntity.fromPersistence(noteProps);
    note.setArchived(!noteProps.isArchived);
    await this.noteRepository.save(note);

    return { note: note.toPersistence() };
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createNoteUseCases(
  noteRepository: INoteRepository,
  fileStorage: IFileStorage,
  markdownProcessor: IMarkdownProcessor
): INoteUseCases {
  return {
    createNote: new CreateNoteUseCase(noteRepository, fileStorage, markdownProcessor),
    updateNote: new UpdateNoteUseCase(noteRepository, fileStorage, markdownProcessor),
    getNote: new GetNoteUseCase(noteRepository, fileStorage, markdownProcessor),
    listNotes: new ListNotesUseCase(noteRepository),
    deleteNote: new DeleteNoteUseCase(noteRepository, fileStorage),
    restoreNote: new RestoreNoteUseCase(noteRepository),
    moveNote: new MoveNoteUseCase(noteRepository),
    searchNotes: new SearchNotesUseCase(noteRepository),
    getNoteContent: new GetNoteContentUseCase(noteRepository, fileStorage, markdownProcessor),
    saveNoteContent: new SaveNoteContentUseCase(noteRepository, fileStorage, markdownProcessor),
    getNoteByPath: new GetNoteByPathUseCase(noteRepository),
    toggleFavorite: new ToggleFavoriteUseCase(noteRepository),
    togglePin: new TogglePinUseCase(noteRepository),
    toggleArchive: new ToggleArchiveUseCase(noteRepository),
  };
}
