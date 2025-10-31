/**
 * NotebookRepository - Handles notebook hierarchy and organization
 */

import { eq, and, sql, desc, asc, isNull, inArray } from 'drizzle-orm';
import { getDatabaseManager } from '../database/DatabaseManager';
import { notebooks, notes } from '../database/schema';
import type { Notebook, InsertNotebook } from '@shared/types';
import { nanoid } from 'nanoid';

interface NotebookWithChildren extends Notebook {
  children?: NotebookWithChildren[];
  noteCount?: number;
}

/**
 * Notebook Repository - Using Drizzle ORM
 */
export class NotebookRepository {
  /**
   * Create a new notebook
   */
  async create(data: Partial<InsertNotebook>): Promise<Notebook> {
    const db = getDatabaseManager().getDrizzle();
    const now = new Date();

    const newNotebook: InsertNotebook = {
      id: nanoid(),
      name: data.name!,
      parentId: data.parentId || null,
      icon: data.icon || '📁',
      color: data.color || '#3b82f6',
      position: data.position || 0,
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
        query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
      }
    }

    // Add ORDER BY
    if (options?.sort) {
      const column = notebooks[options.sort.field as keyof typeof notebooks];
      if (column) {
        query = query.orderBy(options.sort.order === 'DESC' ? desc(column) : asc(column));
      }
    }

    // Add LIMIT and OFFSET
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    const result = await query;
    return result as Notebook[];
  }

  /**
   * Update notebook
   */
  async update(id: string, data: Partial<Notebook>): Promise<Notebook> {
    const db = getDatabaseManager().getDrizzle();
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };

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
    const db = getDatabaseManager().getDb();
    const result = db.transaction(() => {
      return callback();
    })();
    return result;
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
}
