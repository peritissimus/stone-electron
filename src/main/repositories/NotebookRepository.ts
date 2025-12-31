/**
 * NotebookRepository - Handles notebook hierarchy and organization
 */

import { eq, and, sql, desc, asc, isNull, inArray } from 'drizzle-orm';
import { getDatabaseManager } from '../database/DatabaseManager';
import { notebooks, notes, workspaces } from '../database/schema';
import type { Notebook, InsertNotebook } from '@shared/types';
import { nanoid } from 'nanoid';
import path from 'node:path';
import { getFileSystemService } from '../services/FileSystemService';
import { WorkspaceRepository } from './WorkspaceRepository';
import { logger } from '../utils/logger';

interface NotebookWithChildren extends Notebook {
  children?: NotebookWithChildren[];
  noteCount?: number;
}

/**
 * Notebook Repository - Using Drizzle ORM
 */
export class NotebookRepository {
  private readonly workspaceRepository = new WorkspaceRepository();
  private readonly fileSystemService = getFileSystemService();

  /**
   * Create a new notebook
   */
  async create(data: Partial<InsertNotebook>): Promise<Notebook> {
    const db = getDatabaseManager().getDrizzle();
    const now = new Date();

    const workspaceIdOverride =
      typeof data.workspaceId === 'string' && data.workspaceId.length > 0
        ? data.workspaceId
        : null;

    const activeWorkspace = workspaceIdOverride
      ? await this.workspaceRepository.findById(workspaceIdOverride)
      : await this.workspaceRepository.getActive();

    if (!activeWorkspace) {
      throw new Error('No active workspace selected');
    }

    const workspaceId = activeWorkspace.id;

    // Resolve parent notebook (if any)
    let parentNotebook: Notebook | undefined;
    if (data.parentId) {
      parentNotebook = await this.findById(data.parentId);
      if (!parentNotebook) {
        throw new Error('Parent notebook not found');
      }
      if (parentNotebook.workspaceId && parentNotebook.workspaceId !== workspaceId) {
        throw new Error('Parent notebook belongs to a different workspace');
      }
    }

    // Compute folder path for this notebook relative to workspace
    const parentFolderRelative = parentNotebook?.folderPath || '';
    const parentFolderAbsolute = parentFolderRelative
      ? path.join(activeWorkspace.folderPath, parentFolderRelative)
      : activeWorkspace.folderPath;

    const folderName = await this.fileSystemService.generateUniqueFolderName(
      parentFolderAbsolute,
      data.name || 'Notebook',
    );

    const relativeFolderPath =
      parentFolderRelative && parentFolderRelative !== '.'
        ? path.posix.join(parentFolderRelative.replaceAll('\\', '/'), folderName)
        : folderName;

    // Ensure folder exists on disk
    await this.fileSystemService.createFolder(
      path.join(activeWorkspace.folderPath, relativeFolderPath),
    );

    const newNotebook: InsertNotebook = {
      id: nanoid(),
      name: data.name || folderName,
      parentId: data.parentId || null,
      workspaceId,
      folderPath: relativeFolderPath,
      icon: data.icon || '📁',
      color: data.color || '#3b82f6',
      position: data.position ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(notebooks).values(newNotebook);
    return newNotebook as Notebook;
  }

  /**
   * Find notebook by ID
   */
  async findById(id: string): Promise<Notebook | undefined> {
    const db = getDatabaseManager().getDrizzle();
    const result = await db.select().from(notebooks).where(eq(notebooks.id, id)).limit(1);
    return result[0];
  }

  /**
   * Find multiple notebooks by IDs (bulk operation)
   * Returns a Map with notebookId as key and notebook as value
   */
  async findByIds(ids: string[]): Promise<Map<string, Notebook>> {
    const db = getDatabaseManager().getDrizzle();

    if (ids.length === 0) {
      return new Map();
    }

    const result = await db
      .select()
      .from(notebooks)
      .where(inArray(notebooks.id, ids));

    const notebooksMap = new Map<string, Notebook>();
    for (const notebook of result) {
      notebooksMap.set(notebook.id, notebook as Notebook);
    }

    return notebooksMap;
  }

  /**
   * Build WHERE conditions from filter options
   */
  private buildWhereConditions(where: Partial<Notebook>): ReturnType<typeof eq>[] {
    const conditions: ReturnType<typeof eq>[] = [];

    if (where.parentId !== undefined) {
      conditions.push(
        where.parentId === null
          ? isNull(notebooks.parentId)
          : eq(notebooks.parentId, where.parentId),
      );
    }
    if (where.id !== undefined) conditions.push(eq(notebooks.id, where.id));
    if (where.name !== undefined) conditions.push(eq(notebooks.name, where.name));

    return conditions;
  }

  /**
   * Get sort column from field name
   */
  private getSortColumn(field: keyof Notebook) {
    const columnMap = {
      id: notebooks.id,
      name: notebooks.name,
      parentId: notebooks.parentId,
      icon: notebooks.icon,
      color: notebooks.color,
      position: notebooks.position,
      createdAt: notebooks.createdAt,
      updatedAt: notebooks.updatedAt,
      workspaceId: notebooks.workspaceId,
      folderPath: notebooks.folderPath,
    };
    return columnMap[field];
  }

  /**
   * Find all notebooks with optional filtering
   */
  async findAll(options?: {
    where?: Partial<Notebook>;
    sort?: { field: keyof Notebook; order: 'ASC' | 'DESC' };
    limit?: number;
    offset?: number;
  }): Promise<Notebook[]> {
    const db = getDatabaseManager().getDrizzle();
    let query = db.select().from(notebooks);

    if (options?.where) {
      const conditions = this.buildWhereConditions(options.where);
      if (conditions.length > 0) {
        query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
      }
    }

    if (options?.sort) {
      const column = this.getSortColumn(options.sort.field);
      if (column) {
        query = query.orderBy(options.sort.order === 'DESC' ? desc(column) : asc(column));
      }
    }

    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.offset(options.offset);

    const result = await query;
    return result;
  }

  /**
   * Handle folder rename on disk when notebook name changes
   * Returns the new relative folder path if renamed, undefined otherwise
   */
  private async handleFolderRename(
    existing: Notebook,
    newName: string,
  ): Promise<string | undefined> {
    if (!existing.workspaceId || !existing.folderPath) {
      return undefined;
    }

    const workspace = await this.workspaceRepository.findById(existing.workspaceId);
    if (!workspace) {
      return undefined;
    }

    const currentFolderRelative = existing.folderPath.replaceAll('\\', '/');
    const parentRelative = path.posix.dirname(currentFolderRelative);
    const normalizedParent = parentRelative === '.' ? '' : parentRelative;

    const parentAbsolute = normalizedParent
      ? path.join(workspace.folderPath, normalizedParent)
      : workspace.folderPath;
    const currentAbsolute = path.join(workspace.folderPath, currentFolderRelative);

    const newFolderName = await this.fileSystemService.generateUniqueFolderName(
      parentAbsolute,
      newName,
      currentAbsolute,
    );

    const currentName = path.posix.basename(currentFolderRelative);
    if (newFolderName === currentName) {
      return undefined;
    }

    const newRelative = normalizedParent
      ? path.posix.join(normalizedParent, newFolderName)
      : newFolderName;
    const newAbsolute = path.join(workspace.folderPath, newRelative);

    await this.fileSystemService.renameFolder(currentAbsolute, newAbsolute);
    return newRelative;
  }

  /**
   * Update notebook
   */
  async update(id: string, data: Partial<Notebook>): Promise<Notebook> {
    const db = getDatabaseManager().getDrizzle();
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error('Notebook not found');
    }

    const updateData: Partial<Notebook> & { updatedAt: Date } = {
      ...data,
      updatedAt: new Date(),
    };

    // Handle rename on disk if name changes
    if (data.name && data.name !== existing.name) {
      const newFolderPath = await this.handleFolderRename(existing, data.name);
      if (newFolderPath) {
        updateData.folderPath = newFolderPath;
      }
    }

    await db.update(notebooks).set(updateData).where(eq(notebooks.id, id));

    const updated = await this.findById(id);
    if (!updated) throw new Error('Notebook not found after update');
    return updated;
  }

  /**
   * Delete notebook
   */
  async delete(id: string): Promise<boolean> {
    const db = getDatabaseManager().getDrizzle();
    await db.delete(notebooks).where(eq(notebooks.id, id));
    return true;
  }

  /**
   * Execute operations in a transaction
   */
  async transaction<T>(callback: () => T | Promise<T>): Promise<T> {
    const db = getDatabaseManager().getDrizzle();
    return await db.transaction(async () => {
      return await callback();
    });
  }

  /**
   * Get all root notebooks (no parent)
   */
  async getRoots(): Promise<Notebook[]> {
    return await this.findAll({
      where: { parentId: null },
      sort: { field: 'position', order: 'ASC' },
    });
  }

  /**
   * Get children of a notebook
   */
  async getChildren(parentId: string): Promise<Notebook[]> {
    return await this.findAll({
      where: { parentId: parentId },
      sort: { field: 'position', order: 'ASC' },
    });
  }

  /**
   * Get complete hierarchy tree
   */
  async getTree(): Promise<NotebookWithChildren[]> {
    const roots = await this.getRoots();
    return await Promise.all(roots.map((root) => this.buildTree(root)));
  }

  /**
   * Build tree recursively
   */
  private async buildTree(notebook: Notebook): Promise<NotebookWithChildren> {
    const children = await this.getChildren(notebook.id);
    const noteCount = await this.getNoteCount(notebook.id);

    return {
      ...notebook,
      noteCount: noteCount,
      children: await Promise.all(children.map((child) => this.buildTree(child))),
    };
  }

  /**
   * Get note count for a notebook (including sub-notebooks)
   */
  async getNoteCount(notebookId: string, includeSubNotebooks: boolean = false): Promise<number> {
    const db = getDatabaseManager().getDrizzle();

    if (!includeSubNotebooks) {
      const result = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(notes)
        .where(and(eq(notes.notebookId, notebookId), eq(notes.isDeleted, false)));

      return result[0]?.count || 0;
    }

    // Get all notebook IDs in the hierarchy
    const notebookIds = await this.getAllDescendantIds(notebookId);
    notebookIds.push(notebookId);

    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notes)
      .where(and(inArray(notes.notebookId, notebookIds), eq(notes.isDeleted, false)));

    return result[0]?.count || 0;
  }

  /**
   * Get all descendant notebook IDs
   */
  private async getAllDescendantIds(notebookId: string): Promise<string[]> {
    const children = await this.getChildren(notebookId);
    const ids: string[] = [];

    for (const child of children) {
      ids.push(child.id);
      const childDescendants = await this.getAllDescendantIds(child.id);
      ids.push(...childDescendants);
    }

    return ids;
  }

  /**
   * Move a notebook to a new parent
   */
  async move(
    notebookId: string,
    newParentId: string | null,
    newPosition?: number,
  ): Promise<Notebook> {
    // Prevent moving a notebook into itself or its descendants
    if (newParentId) {
      const descendants = await this.getAllDescendantIds(notebookId);
      if (descendants.includes(newParentId) || notebookId === newParentId) {
        throw new Error('Cannot move notebook into itself or its descendants');
      }
    }

    const updateData: Partial<Notebook> = {
      parentId: newParentId,
    } as Partial<Notebook>;

    if (newPosition !== undefined) {
      updateData.position = newPosition;
    }

    return await this.update(notebookId, updateData);
  }

  /**
   * Delete notebook and optionally move notes
   */
  async deleteWithNotes(
    notebookId: string,
    action: 'delete' | 'orphan' | 'move',
    targetNotebookId?: string,
  ): Promise<void> {
    await this.transaction(async () => {
      const db = getDatabaseManager().getDrizzle();

      if (action === 'delete') {
        // Delete all notes in this notebook and descendants
        const allIds = [notebookId, ...(await this.getAllDescendantIds(notebookId))];

        await db
          .update(notes)
          .set({
            isDeleted: true,
            deletedAt: new Date(),
          })
          .where(inArray(notes.notebookId, allIds));
      } else if (action === 'orphan') {
        // Set notes' notebookId to NULL
        await db.update(notes).set({ notebookId: null }).where(eq(notes.notebookId, notebookId));
      } else if (action === 'move' && targetNotebookId) {
        // Move notes to target notebook
        await db
          .update(notes)
          .set({ notebookId: targetNotebookId })
          .where(eq(notes.notebookId, notebookId));
      }

      // Delete the notebook (CASCADE will handle children)
      await this.delete(notebookId);
    });
  }

  /**
   * Get flat list of all notebooks
   */
  async getFlatList(): Promise<Notebook[]> {
    return await this.findAll({
      sort: { field: 'name', order: 'ASC' },
    });
  }

  /**
   * Helper to upsert a notebook for a folder during sync
   */
  private async syncUpsertNotebook(
    relPath: string,
    name: string,
    parentRelPath: string | null,
    position: number,
    workspaceId: string,
    existingByPath: Map<string, Notebook>,
    existingByName: Map<string, Notebook>,
  ): Promise<{ notebook: Notebook; created: boolean; updated: boolean }> {
    const db = getDatabaseManager().getDrizzle();
    const parentRelKey = parentRelPath ? parentRelPath.replaceAll('\\', '/') : '';
    const parent = parentRelKey ? existingByPath.get(parentRelKey) : null;
    const relKey = relPath ? relPath.replaceAll('\\', '/') : '';

    let existing = existingByPath.get(relKey);
    if (!existing) {
      const parentKey = parent ? parent.id : 'root';
      const nameKey = `${parentKey}::${name.toLowerCase()}`;
      existing = existingByName.get(nameKey);
    }
    const now = new Date();

    if (existing) {
      const needsUpdate =
        existing.name !== name ||
        (existing.parentId || null) !== (parent?.id || null) ||
        existing.folderPath !== relKey ||
        existing.workspaceId !== workspaceId;

      if (needsUpdate) {
        await db
          .update(notebooks)
          .set({
            name,
            parentId: parent?.id || null,
            folderPath: relKey,
            workspaceId,
            updatedAt: now,
          })
          .where(eq(notebooks.id, existing.id));

        const updatedNb = {
          ...existing,
          name,
          parentId: parent?.id || null,
          folderPath: relKey,
          workspaceId,
          updatedAt: now,
        } as Notebook;
        existingByPath.set(relKey, updatedNb);
        const nameKey = `${parent?.id || 'root'}::${name.toLowerCase()}`;
        existingByName.set(nameKey, updatedNb);
        return { notebook: updatedNb, created: false, updated: true };
      }
      return { notebook: existing, created: false, updated: false };
    }

    const nb: InsertNotebook = {
      id: nanoid(),
      name,
      parentId: parent?.id || null,
      workspaceId,
      folderPath: relKey,
      icon: '📁',
      color: '#3b82f6',
      position,
      createdAt: now,
      updatedAt: now,
    } as InsertNotebook;
    await db.insert(notebooks).values(nb);
    const createdNb = nb as unknown as Notebook;
    existingByPath.set(relKey, createdNb);
    const nameKey = `${parent?.id || 'root'}::${name.toLowerCase()}`;
    existingByName.set(nameKey, createdNb);
    return { notebook: createdNb, created: true, updated: false };
  }

  /**
   * Traverse folder structure recursively and sync notebooks
   */
  private async syncTraverseFolders(
    nodes: { type: string; relativePath: string; name: string; children?: any[] }[],
    parentRelPath: string | null,
    workspaceId: string,
    existingByPath: Map<string, Notebook>,
    existingByName: Map<string, Notebook>,
  ): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    const folders = nodes.filter((n) => n.type === 'folder');

    for (let i = 0; i < folders.length; i++) {
      const node = folders[i];
      const result = await this.syncUpsertNotebook(
        node.relativePath,
        node.name,
        parentRelPath,
        i,
        workspaceId,
        existingByPath,
        existingByName,
      );
      if (result.created) created++;
      if (result.updated) updated++;

      if (node.children && node.children.length > 0) {
        const childResult = await this.syncTraverseFolders(
          node.children,
          node.relativePath,
          workspaceId,
          existingByPath,
          existingByName,
        );
        created += childResult.created;
        updated += childResult.updated;
      }
    }
    return { created, updated };
  }

  /**
   * Sync notebooks with workspace folder structure
   * Creates/updates notebooks to mirror folders under the workspace root.
   */
  async syncWithWorkspaceFolders(
    workspaceId: string,
  ): Promise<{ created: number; updated: number; errors: string[] }> {
    const db = getDatabaseManager().getDrizzle();
    const errors: string[] = [];

    // Get workspace info
    const ws = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
    const workspace = ws[0] as { folderPath: string } | undefined;
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    // Load existing notebooks for this workspace
    const existingList = await db
      .select()
      .from(notebooks)
      .where(eq(notebooks.workspaceId, workspaceId));

    const existingByPath = new Map<string, Notebook>();
    const existingByName = new Map<string, Notebook>();

    for (const notebook of existingList as Notebook[]) {
      const relKey =
        notebook.folderPath?.trim()
          ? notebook.folderPath.replaceAll('\\', '/')
          : '';
      existingByPath.set(relKey, notebook);

      const parentKey = notebook.parentId || 'root';
      const nameKey = `${parentKey}::${(notebook.name || '').toLowerCase()}`;
      existingByName.set(nameKey, notebook);
    }

    let created = 0;
    let updated = 0;

    try {
      const structure = await this.fileSystemService.getFolderStructure(workspace.folderPath);
      logger.info(`[NotebookRepository] Folder structure count: ${structure.length}`);

      const result = await this.syncTraverseFolders(
        structure,
        null,
        workspaceId,
        existingByPath,
        existingByName,
      );
      created = result.created;
      updated = result.updated;
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.error('[NotebookRepository] Folder sync error', e);
      errors.push(errorMessage);
    }

    logger.info(
      `[NotebookRepository] Sync completed: created=${created}, updated=${updated}, errors=${errors.length}`,
    );
    return { created, updated, errors };
  }
}
