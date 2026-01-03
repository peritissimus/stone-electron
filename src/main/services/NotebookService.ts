/**
 * NotebookService - Notebook management
 *
 * Handles notebook CRUD, hierarchy, and note counts.
 */

import { EVENTS } from '@shared/constants/ipcChannels';
import { logger } from '../utils/logger';
import type { Notebook } from '@shared/types';
import type { NotebookRepository } from '../repositories/NotebookRepository';
import type { EventBus } from './EventBus';

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
 * Dependencies for NotebookService
 */
export interface NotebookServiceDeps {
  notebookRepository: NotebookRepository;
  eventBus: EventBus;
}

/**
 * NotebookService handles notebook operations
 */
export class NotebookService {
  constructor(private readonly deps: NotebookServiceDeps) {}

  // ==========================================================================
  // Notebook CRUD
  // ==========================================================================

  /**
   * Create a new notebook
   */
  async createNotebook(data: CreateNotebookRequest): Promise<NotebookWithCount> {
    const notebook = await this.deps.notebookRepository.create({
      name: data.name,
      parentId: data.parentId || null,
      icon: data.icon || '📁',
      color: data.color || '#3b82f6',
      position: data.position || 0,
    });

    const noteCount = await this.deps.notebookRepository.getNoteCount(notebook.id);

    this.deps.eventBus.emit(EVENTS.NOTEBOOK_CREATED, { notebook });

    logger.info(`[NotebookService] Created notebook: ${notebook.name}`);

    return { ...notebook, note_count: noteCount };
  }

  /**
   * Update a notebook
   */
  async updateNotebook(id: string, data: UpdateNotebookRequest): Promise<Notebook> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.position !== undefined) updateData.position = data.position;

    const notebook = await this.deps.notebookRepository.update(id, updateData);

    this.deps.eventBus.emit(EVENTS.NOTEBOOK_UPDATED, { notebook });

    logger.info(`[NotebookService] Updated notebook: ${notebook.name}`);

    return notebook;
  }

  /**
   * Delete a notebook
   */
  async deleteNotebook(id: string, deleteNotes: boolean = false): Promise<void> {
    const action = deleteNotes ? 'delete' : 'orphan';
    await this.deps.notebookRepository.deleteWithNotes(id, action);

    this.deps.eventBus.emit(EVENTS.NOTEBOOK_DELETED, { id });

    logger.info(`[NotebookService] Deleted notebook: ${id} (notes: ${action})`);
  }

  // ==========================================================================
  // Notebook Queries
  // ==========================================================================

  /**
   * Get all notebooks as a flat list
   */
  async getAllFlat(includeCounts: boolean = false): Promise<NotebookWithCount[]> {
    const notebooks = await this.deps.notebookRepository.getFlatList();

    if (!includeCounts) {
      return notebooks.map((nb) => ({ ...nb, note_count: 0 }));
    }

    // Bulk load note counts
    const notebooksWithCounts = await Promise.all(
      notebooks.map(async (nb) => ({
        ...nb,
        note_count: await this.deps.notebookRepository.getNoteCount(nb.id),
      })),
    );

    return notebooksWithCounts;
  }

  /**
   * Get notebooks as a tree structure
   */
  async getTree(): Promise<NotebookTreeNode[]> {
    return this.deps.notebookRepository.getTree();
  }

  /**
   * Get note count for a notebook
   */
  async getNoteCount(notebookId: string): Promise<number> {
    return this.deps.notebookRepository.getNoteCount(notebookId);
  }

  /**
   * Find notebook by ID
   */
  async findById(id: string): Promise<Notebook | null> {
    return (await this.deps.notebookRepository.findById(id)) ?? null;
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
    const notebook = await this.deps.notebookRepository.move(id, parentId, position);

    this.deps.eventBus.emit(EVENTS.NOTEBOOK_UPDATED, { notebook });

    logger.info(`[NotebookService] Moved notebook: ${id} → parent: ${parentId}`);

    return notebook;
  }

  /**
   * Sync notebooks with workspace folders
   */
  async syncWithWorkspace(workspaceId: string): Promise<{ created: number; updated: number; errors: string[] }> {
    return this.deps.notebookRepository.syncWithWorkspaceFolders(workspaceId);
  }
}

// ==========================================================================
// Singleton for backward compatibility (IPC handlers)
// ==========================================================================

import { getRepositories } from '../repositories';
import { getEventBus } from './EventBus';

let instance: NotebookService | null = null;

export function getNotebookService(): NotebookService {
  if (!instance) {
    const repos = getRepositories();
    instance = new NotebookService({
      notebookRepository: repos.notebook,
      eventBus: getEventBus(),
    });
  }
  return instance;
}

/**
 * Create NotebookService with custom dependencies (for DI container)
 */
export function createNotebookService(deps: NotebookServiceDeps): NotebookService {
  return new NotebookService(deps);
}
