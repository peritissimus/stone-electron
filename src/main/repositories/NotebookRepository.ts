/**
 * NotebookRepository - Handles notebook hierarchy and organization
 */

import { eq, and, sql, desc, asc, isNull, inArray } from 'drizzle-orm';
import { getDatabaseManager } from '../database/DatabaseManager';
import { notebooks, notes, workspaces } from '../database/schema';
import type { Notebook, InsertNotebook } from '@shared/types';
import { nanoid } from 'nanoid';
import path from 'path';
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
  private workspaceRepository = new WorkspaceRepository();
  private fileSystemService = getFileSystemService();

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
        ? path.posix.join(parentFolderRelative.replace(/\\/g, '/'), folderName)
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

    // Add WHERE clause
    if (options?.where) {
      const conditions = [];
      if (options.where.parentId !== undefined) {
        if (options.where.parentId === null) {
          conditions.push(isNull(notebooks.parentId));
        } else {
          conditions.push(eq(notebooks.parentId, options.where.parentId));
        }
      }
      if (options.where.id !== undefined) conditions.push(eq(notebooks.id, options.where.id));
      if (options.where.name !== undefined) conditions.push(eq(notebooks.name, options.where.name));

      if (conditions.length > 0) {
        query = (query as any).where(conditions.length === 1 ? conditions[0] : and(...conditions));
      }
    }

    // Add ORDER BY
    if (options?.sort) {
      const columnMap = {
        id: notebooks.id,
        name: notebooks.name,
        parentId: notebooks.parentId,
        icon: notebooks.icon,
        color: notebooks.color,
        position: notebooks.position,
        createdAt: notebooks.createdAt,
        updatedAt: notebooks.updatedAt,
      };

      const column = columnMap[options.sort.field as keyof typeof columnMap];
      if (column) {
        query = (query as any).orderBy(options.sort.order === 'DESC' ? desc(column) : asc(column));
      }
    }

    // Add LIMIT and OFFSET
    if (options?.limit) {
      query = (query as any).limit(options.limit);
    }
    if (options?.offset) {
      query = (query as any).offset(options.offset);
    }

    const result = await (query as any);
    return result as Notebook[];
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

    const updateData = {
      ...data,
      updatedAt: new Date(),
    };

    // Handle rename on disk if name changes
    if (
      data.name &&
      data.name !== existing.name &&
      existing.workspaceId &&
      existing.folderPath
    ) {
      const workspace = await this.workspaceRepository.findById(existing.workspaceId);
      if (workspace) {
        const currentFolderRelative = existing.folderPath.replace(/\\/g, '/');
        const parentRelative = path.posix.dirname(currentFolderRelative);
        const normalizedParent =
          parentRelative && parentRelative !== '.'
            ? parentRelative
            : '';
        const parentAbsolute = normalizedParent
          ? path.join(workspace.folderPath, normalizedParent)
          : workspace.folderPath;
        const currentAbsolute = path.join(workspace.folderPath, currentFolderRelative);

        const newFolderName = await this.fileSystemService.generateUniqueFolderName(
          parentAbsolute,
          data.name,
          currentAbsolute,
        );

        const currentName = path.posix.basename(currentFolderRelative);
        if (newFolderName !== currentName) {
          const newRelative =
            normalizedParent && normalizedParent !== ''
              ? path.posix.join(normalizedParent, newFolderName)
              : newFolderName;
          const newAbsolute = path.join(workspace.folderPath, newRelative);
          await this.fileSystemService.renameFolder(currentAbsolute, newAbsolute);
          updateData.folderPath = newRelative;
        }
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
   * Sync notebooks with workspace folder structure
   * Creates/updates notebooks to mirror folders under the workspace root.
   */
  async syncWithWorkspaceFolders(
    workspaceId: string,
  ): Promise<{ created: number; updated: number; errors: string[] }> {
    const db = getDatabaseManager().getDrizzle();
    const errors: string[] = [];
    let created = 0;
    let updated = 0;

    // Get workspace info
    const ws = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
    const workspace = ws[0] as any;
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

    (existingList as Notebook[]).forEach((notebook) => {
      const relKey =
        notebook.folderPath && notebook.folderPath.trim().length > 0
          ? notebook.folderPath.replace(/\\/g, '/')
          : '';
      existingByPath.set(relKey, notebook);

      const parentKey = notebook.parentId || 'root';
      const nameKey = `${parentKey}::${(notebook.name || '').toLowerCase()}`;
      existingByName.set(nameKey, notebook);
    });

    // Helper to upsert a notebook for a folder
    const ensureNotebook = async (
      relPath: string,
      name: string,
      parentRelPath: string | null,
      position: number,
    ): Promise<Notebook> => {
      const parentRelKey = parentRelPath ? parentRelPath.replace(/\\/g, '/') : '';
      const parent = parentRelKey ? existingByPath.get(parentRelKey) : null;
      const relKey = relPath ? relPath.replace(/\\/g, '/') : '';

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
          (existing.parentId || null) !== (parent ? parent.id : null) ||
          existing.folderPath !== relKey ||
          existing.workspaceId !== workspaceId;
        if (needsUpdate) {
          await db
            .update(notebooks)
            .set({
              name,
              parentId: parent ? parent.id : null,
              folderPath: relKey,
              workspaceId,
              updatedAt: now,
            })
            .where(eq(notebooks.id, existing.id));
          const updatedNb = {
            ...existing,
            name,
            parentId: parent ? parent.id : null,
            folderPath: relKey,
            workspaceId,
            updatedAt: now,
          } as Notebook;
          existingByPath.set(relKey, updatedNb);
          const nameKey = `${parent ? parent.id : 'root'}::${name.toLowerCase()}`;
          existingByName.set(nameKey, updatedNb);
          updated++;
          return updatedNb;
        }
        return existing;
      } else {
        const nb: InsertNotebook = {
          id: nanoid(),
          name,
          parentId: parent ? parent.id : null,
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
        const nameKey = `${parent ? parent.id : 'root'}::${name.toLowerCase()}`;
        existingByName.set(nameKey, createdNb);
        created++;
        return createdNb;
      }
    };

    // Traverse folder structure recursively
    const traverse = async (nodes: any[], parentRelPath: string | null) => {
      // Only folders
      const folders = nodes.filter((n) => n.type === 'folder');
      for (let i = 0; i < folders.length; i++) {
        const node = folders[i];
        const rel = node.relativePath;
        const name = node.name;
        const nb = await ensureNotebook(rel, name, parentRelPath, i);
        if (node.children && node.children.length > 0) {
          await traverse(node.children, rel);
        }
      }
    };

    try {
      const structure = await this.fileSystemService.getFolderStructure(workspace.folderPath);
      logger.info(`[NotebookRepository] Folder structure count: ${structure.length}`);
      await traverse(structure, null);
    } catch (e: any) {
      logger.error('[NotebookRepository] Folder sync error', e);
      errors.push(String(e?.message || e));
    }

    logger.info(
      `[NotebookRepository] Sync completed: created=${created}, updated=${updated}, errors=${errors.length}`,
    );
    return { created, updated, errors };
  }
}
