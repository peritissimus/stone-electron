/**
 * Note Repository Port (Outbound)
 *
 * Defines the contract for note persistence operations.
 * Implementations can be SQLite, PostgreSQL, in-memory, etc.
 *
 * Note: This port includes content and embedding operations for now.
 * In a stricter design, these would be separate ports (IFileStorage, IEmbeddingStore).
 */

import type { NoteEntity, NoteProps } from '../../entities';

export interface NoteFindOptions {
  workspaceId?: string;
  notebookId?: string | null;
  isFavorite?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  isDeleted?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'title';
  orderDirection?: 'asc' | 'desc';
}

export interface NoteSearchOptions {
  query: string;
  workspaceId?: string;
  limit?: number;
}

export interface INoteRepository {
  /**
   * Find a note by ID
   */
  findById(id: string): Promise<NoteProps | null>;

  /**
   * Find all notes matching the given options
   */
  findAll(options?: NoteFindOptions): Promise<NoteProps[]>;

  /**
   * Find notes by notebook ID
   */
  findByNotebookId(notebookId: string | null, workspaceId?: string): Promise<NoteProps[]>;

  /**
   * Find notes by workspace ID
   */
  findByWorkspaceId(workspaceId: string): Promise<NoteProps[]>;

  /**
   * Find note by file path
   */
  findByFilePath(filePath: string, workspaceId?: string): Promise<NoteProps | null>;

  /**
   * Save a note (create or update)
   */
  save(note: NoteEntity): Promise<void>;

  /**
   * Delete a note permanently
   */
  delete(id: string): Promise<void>;

  /**
   * Search notes by title (full-text search)
   */
  searchByTitle(options: NoteSearchOptions): Promise<NoteProps[]>;

  /**
   * Count notes matching the given options
   */
  count(options?: NoteFindOptions): Promise<number>;

  /**
   * Check if a note exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Get recently updated notes
   */
  findRecentlyUpdated(limit: number, workspaceId?: string): Promise<NoteProps[]>;

  /**
   * Get favorite notes
   */
  findFavorites(workspaceId?: string): Promise<NoteProps[]>;

  /**
   * Get pinned notes
   */
  findPinned(workspaceId?: string): Promise<NoteProps[]>;

  /**
   * Get archived notes
   */
  findArchived(workspaceId?: string): Promise<NoteProps[]>;

  /**
   * Get deleted notes (trash)
   */
  findDeleted(workspaceId?: string): Promise<NoteProps[]>;

  // ============================================================================
  // Content Operations (TODO: Consider moving to IFileStorage)
  // ============================================================================

  /**
   * Get note content by ID (from file)
   */
  getContentById(id: string): Promise<string | null>;

  // ============================================================================
  // Embedding Operations (TODO: Consider moving to IEmbeddingStore)
  // ============================================================================

  /**
   * Get embedding for a note
   */
  getEmbedding(noteId: string): Promise<number[] | null>;

  /**
   * Update embedding for a note
   */
  updateEmbedding(noteId: string, embedding: number[] | null): Promise<void>;

  /**
   * Find notes by similarity to an embedding vector
   */
  findBySimilarity(
    embedding: number[],
    limit: number,
    workspaceId?: string,
  ): Promise<Array<{ noteId: string; title: string; distance: number }>>;
}
