/**
 * Notebook Repository Port (Outbound)
 *
 * Defines the contract for notebook persistence operations.
 */

import type { NotebookEntity, NotebookProps } from '../../entities';

export interface NotebookFindOptions {
  workspaceId?: string;
  parentId?: string | null;
  includeNoteCount?: boolean;
}

export interface NotebookWithCount extends NotebookProps {
  noteCount: number;
}

export interface INotebookRepository {
  /**
   * Find a notebook by ID
   */
  findById(id: string): Promise<NotebookProps | null>;

  /**
   * Find all notebooks matching the given options
   */
  findAll(options?: NotebookFindOptions): Promise<NotebookProps[]>;

  /**
   * Find all notebooks with note counts
   */
  findAllWithCounts(workspaceId?: string): Promise<NotebookWithCount[]>;

  /**
   * Find notebooks by workspace ID
   */
  findByWorkspaceId(workspaceId: string): Promise<NotebookProps[]>;

  /**
   * Find notebooks by parent ID
   */
  findByParentId(parentId: string | null, workspaceId?: string): Promise<NotebookProps[]>;

  /**
   * Find notebook by folder path
   */
  findByFolderPath(folderPath: string, workspaceId?: string): Promise<NotebookProps | null>;

  /**
   * Save a notebook (create or update)
   */
  save(notebook: NotebookEntity): Promise<void>;

  /**
   * Delete a notebook
   */
  delete(id: string): Promise<void>;

  /**
   * Get all ancestor IDs of a notebook (for preventing circular references)
   */
  getAncestorIds(id: string): Promise<string[]>;

  /**
   * Get all descendant IDs of a notebook
   */
  getDescendantIds(id: string): Promise<string[]>;

  /**
   * Check if a notebook exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Count notebooks in a workspace
   */
  count(workspaceId?: string): Promise<number>;

  /**
   * Update positions for reordering
   */
  updatePositions(updates: Array<{ id: string; position: number }>): Promise<void>;
}
