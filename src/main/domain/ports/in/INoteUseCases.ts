/**
 * Note Use Cases Port (Inbound)
 *
 * Defines what the application CAN DO with Notes.
 * Implementations live in the application layer.
 */

import { Context } from 'effect';
import type { Effect } from 'effect';
import type { NoteProps } from '../../entities';

/**
 * Create a new note
 */
export interface ICreateNoteUseCase {
  execute(request: {
    id?: string;
    title?: string;
    content?: string;
    folderPath?: string;
    notebookId?: string;
    workspaceId?: string;
  }): Effect.Effect<{ note: NoteProps }, Error>;
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
  }): Effect.Effect<{ note: NoteProps }, Error>;
}

/**
 * Get a note by ID
 */
export interface IGetNoteUseCase {
  execute(request: { id: string; includeContent?: boolean }): Effect.Effect<{
    note: NoteProps;
    content?: string;
  }, Error>;
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
  }): Effect.Effect<{ notes: NoteProps[]; total: number }, Error>;
}

/**
 * Delete a note (soft or permanent)
 */
export interface IDeleteNoteUseCase {
  execute(request: { id: string; permanent?: boolean }): Effect.Effect<void, Error>;
}

/**
 * Restore a deleted note
 */
export interface IRestoreNoteUseCase {
  execute(request: { id: string }): Effect.Effect<void, Error>;
}

/**
 * Move a note to a different notebook
 */
export interface IMoveNoteUseCase {
  execute(request: {
    id: string;
    targetNotebookId: string | null;
  }): Effect.Effect<void, Error>;
}

/**
 * Search notes by query
 */
export interface ISearchNotesUseCase {
  execute(request: {
    query: string;
    workspaceId?: string;
    limit?: number;
  }): Effect.Effect<{ notes: NoteProps[]; total: number }, Error>;
}

/**
 * Get note content from file
 */
export interface IGetNoteContentUseCase {
  execute(request: { id: string }): Effect.Effect<{ content: string }, Error>;
}

/**
 * Save note content to file
 */
export interface ISaveNoteContentUseCase {
  execute(request: { id: string; content: string }): Effect.Effect<void, Error>;
}

/**
 * Get note by file path
 */
export interface IGetNoteByPathUseCase {
  execute(request: {
    filePath: string;
    workspaceId?: string;
  }): Effect.Effect<{ note: NoteProps }, Error>;
}

/**
 * Toggle favorite status
 */
export interface IToggleFavoriteUseCase {
  execute(request: { id: string }): Effect.Effect<{ note: NoteProps }, Error>;
}

/**
 * Toggle pin status
 */
export interface ITogglePinUseCase {
  execute(request: { id: string }): Effect.Effect<{ note: NoteProps }, Error>;
}

/**
 * Toggle archive status
 */
export interface IToggleArchiveUseCase {
  execute(request: { id: string }): Effect.Effect<{ note: NoteProps }, Error>;
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

export const NoteUseCasesPort =
  Context.GenericTag<INoteUseCases>('stone/INoteUseCases');
