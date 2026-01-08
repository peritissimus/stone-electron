/**
 * Note Use Cases Port (Inbound)
 *
 * Defines what the application CAN DO with Notes.
 * Implementations live in the application layer.
 */

import type { NoteProps } from '../../entities';

/**
 * Create a new note
 */
export interface ICreateNoteUseCase {
  execute(request: {
    id: string;
    title?: string;
    content?: string;
    folderPath?: string;
    notebookId?: string;
    workspaceId?: string;
  }): Promise<{ note: NoteProps }>;
}

/**
 * Update an existing note
 */
export interface IUpdateNoteUseCase {
  execute(request: {
    id: string;
    title?: string;
    content?: string;
    notebookId?: string;
    isFavorite?: boolean;
    isPinned?: boolean;
    isArchived?: boolean;
  }): Promise<{ note: NoteProps }>;
}

/**
 * Get a note by ID
 */
export interface IGetNoteUseCase {
  execute(request: { id: string; includeContent?: boolean }): Promise<{
    note: NoteProps;
    content?: string;
  }>;
}

/**
 * List notes with filtering
 */
export interface IListNotesUseCase {
  execute(request: {
    workspaceId?: string;
    notebookId?: string | null;
    filter?: 'all' | 'favorites' | 'pinned' | 'archived' | 'trash';
    limit?: number;
    offset?: number;
    orderBy?: 'createdAt' | 'updatedAt' | 'title';
    orderDirection?: 'asc' | 'desc';
  }): Promise<{ notes: NoteProps[]; total: number }>;
}

/**
 * Delete a note (soft or permanent)
 */
export interface IDeleteNoteUseCase {
  execute(request: { id: string; permanent?: boolean }): Promise<void>;
}

/**
 * Restore a deleted note
 */
export interface IRestoreNoteUseCase {
  execute(request: { id: string }): Promise<void>;
}

/**
 * Move a note to a different notebook
 */
export interface IMoveNoteUseCase {
  execute(request: { id: string; targetNotebookId: string | null }): Promise<void>;
}

/**
 * Search notes by query
 */
export interface ISearchNotesUseCase {
  execute(request: {
    query: string;
    workspaceId?: string;
    limit?: number;
  }): Promise<{ notes: NoteProps[]; total: number }>;
}

/**
 * Get note content from file
 */
export interface IGetNoteContentUseCase {
  execute(request: { id: string }): Promise<{ content: string }>;
}

/**
 * Save note content to file
 */
export interface ISaveNoteContentUseCase {
  execute(request: { id: string; content: string }): Promise<void>;
}

/**
 * Get note by file path
 */
export interface IGetNoteByPathUseCase {
  execute(request: { filePath: string }): Promise<{ note: NoteProps }>;
}

/**
 * Toggle favorite status
 */
export interface IToggleFavoriteUseCase {
  execute(request: { id: string }): Promise<{ note: NoteProps }>;
}

/**
 * Toggle pin status
 */
export interface ITogglePinUseCase {
  execute(request: { id: string }): Promise<{ note: NoteProps }>;
}

/**
 * Toggle archive status
 */
export interface IToggleArchiveUseCase {
  execute(request: { id: string }): Promise<{ note: NoteProps }>;
}

/**
 * Aggregated Note Use Cases
 */
export interface INoteUseCases {
  createNote: ICreateNoteUseCase;
  updateNote: IUpdateNoteUseCase;
  getNote: IGetNoteUseCase;
  listNotes: IListNotesUseCase;
  deleteNote: IDeleteNoteUseCase;
  restoreNote: IRestoreNoteUseCase;
  moveNote: IMoveNoteUseCase;
  searchNotes: ISearchNotesUseCase;
  getNoteContent: IGetNoteContentUseCase;
  saveNoteContent: ISaveNoteContentUseCase;
  getNoteByPath: IGetNoteByPathUseCase;
  toggleFavorite: IToggleFavoriteUseCase;
  togglePin: ITogglePinUseCase;
  toggleArchive: IToggleArchiveUseCase;
}
