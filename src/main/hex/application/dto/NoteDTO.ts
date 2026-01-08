/**
 * Note DTOs
 *
 * Data Transfer Objects for note operations.
 */

import type { NoteProps } from '../../domain/entities';

// ============================================================================
// Request DTOs
// ============================================================================

export interface CreateNoteDTO {
  title?: string;
  content?: string;
  folderPath?: string;
  notebookId?: string;
  workspaceId?: string;
  tags?: string[];
}

export interface UpdateNoteDTO {
  id: string;
  title?: string;
  content?: string;
  notebookId?: string;
  isFavorite?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  tags?: string[];
}

export interface GetNoteDTO {
  id: string;
  includeContent?: boolean;
}

export interface ListNotesDTO {
  workspaceId?: string;
  notebookId?: string | null;
  filter?: 'all' | 'favorites' | 'pinned' | 'archived' | 'trash';
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'title';
  orderDirection?: 'asc' | 'desc';
}

export interface DeleteNoteDTO {
  id: string;
  permanent?: boolean;
}

export interface RestoreNoteDTO {
  id: string;
}

export interface MoveNoteDTO {
  id: string;
  targetNotebookId: string | null;
}

export interface SearchNotesDTO {
  query: string;
  workspaceId?: string;
  limit?: number;
}

export interface GetNoteContentDTO {
  id: string;
}

export interface SaveNoteContentDTO {
  id: string;
  content: string;
}

// ============================================================================
// Response DTOs
// ============================================================================

export interface NoteResponseDTO {
  note: NoteProps;
}

export interface NoteWithContentResponseDTO {
  note: NoteProps;
  content?: string;
}

export interface NoteListResponseDTO {
  notes: NoteProps[];
  total: number;
}

export interface NoteContentResponseDTO {
  content: string;
}
