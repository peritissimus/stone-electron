/**
 * NotebookService - Notebook management
 *
 * Handles notebook CRUD, hierarchy, and note counts.
 */

import { getRepositories } from '../repositories';
import { getEventBus } from './EventBus';
import { EVENTS } from '@shared/constants/ipcChannels';
import { logger } from '../utils/logger';
import type { Notebook } from '@shared/types';

export interface CreateNotebookRequest {
  name: string;
  parentId?: string | null;
  icon?: string;
  color?: string;
  position?: number;
}

export interface UpdateNotebookRequest {
  name?: string;
  icon?: string;
  color?: string;
  position?: number;
}

export interface NotebookWithCount extends Notebook {
  note_count: number;
}

export interface NotebookTreeNode extends Notebook {
  children?: NotebookTreeNode[];
  note_count?: number;
}

/**
 * NotebookService handles notebook operations
 */
class NotebookService {
  // ==========================================================================
  // Notebook CRUD
  // ==========================================================================

  /**
   * Create a new notebook
   */
  async createNotebook(data: CreateNotebookRequest): Promise<NotebookWithCount> {
    const repos = getRepositories();

    const notebook = await repos.notebook.create({
      name: data.name,
      parentId: data.parentId || null,
      icon: data.icon || '📁',
      color: data.color || '#3b82f6',
      position: data.position || 0,
    });

    const noteCount = await repos.notebook.getNoteCount(notebook.id);

    getEventBus().emit(EVENTS.NOTEBOOK_CREATED, { notebook });

    logger.info(`[NotebookService] Created notebook: ${notebook.name}`);

    return { ...notebook, note_count: noteCount };
  }

  /**
   * Update a notebook
   */
  async updateNotebook(id: string, data: UpdateNotebookRequest): Promise<Notebook> {
    const repos = getRepositories();

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.position !== undefined) updateData.position = data.position;

    const notebook = await repos.notebook.update(id, updateData);

    getEventBus().emit(EVENTS.NOTEBOOK_UPDATED, { notebook });

    logger.info(`[NotebookService] Updated notebook: ${notebook.name}`);

    return notebook;
  }

  /**
   * Delete a notebook
   */
  async deleteNotebook(id: string, deleteNotes: boolean = false): Promise<void> {
    const repos = getRepositories();

    const action = deleteNotes ? 'delete' : 'orphan';
    await repos.notebook.deleteWithNotes(id, action);

    getEventBus().emit(EVENTS.NOTEBOOK_DELETED, { id });

    logger.info(`[NotebookService] Deleted notebook: ${id} (notes: ${action})`);
  }

  // ==========================================================================
  // Notebook Queries
  // ==========================================================================

  /**
   * Get all notebooks as a flat list
   */
  async getAllFlat(includeCounts: boolean = false): Promise<NotebookWithCount[]> {
    const repos = getRepositories();

    const notebooks = await repos.notebook.getFlatList();

    if (!includeCounts) {
      return notebooks.map((nb) => ({ ...nb, note_count: 0 }));
    }

    // Bulk load note counts
    const notebooksWithCounts = await Promise.all(
      notebooks.map(async (nb) => ({
        ...nb,
        note_count: await repos.notebook.getNoteCount(nb.id),
      })),
    );

    return notebooksWithCounts;
  }

  /**
   * Get notebooks as a tree structure
   */
  async getTree(): Promise<NotebookTreeNode[]> {
    const repos = getRepositories();
    return repos.notebook.getTree();
  }

  /**
   * Get note count for a notebook
   */
  async getNoteCount(notebookId: string): Promise<number> {
    const repos = getRepositories();
    return repos.notebook.getNoteCount(notebookId);
  }

  // ==========================================================================
  // Notebook Operations
  // ==========================================================================

  /**
   * Move a notebook to a new parent/position
   */
  async moveNotebook(
    id: string,
    parentId: string | null,
    position?: number,
  ): Promise<Notebook> {
    const repos = getRepositories();

    const notebook = await repos.notebook.move(id, parentId, position);

    getEventBus().emit(EVENTS.NOTEBOOK_UPDATED, { notebook });

    logger.info(`[NotebookService] Moved notebook: ${id} → parent: ${parentId}`);

    return notebook;
  }

  /**
   * Sync notebooks with workspace folders
   */
  async syncWithWorkspace(workspaceId: string): Promise<{ created: number; updated: number; errors: string[] }> {
    const repos = getRepositories();
    return repos.notebook.syncWithWorkspaceFolders(workspaceId);
  }
}

// Singleton instance
let instance: NotebookService | null = null;

export function getNotebookService(): NotebookService {
  instance ??= new NotebookService();
  return instance;
}
