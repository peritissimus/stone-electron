/**
 * Notebook Repository Adapter
 *
 * Implements INotebookRepository port using SQLite via Drizzle ORM.
 */

import { eq, and, isNull, sql } from 'drizzle-orm';
import { notebooks, notes, type Database } from '../../../shared';
import type {
  NotebookEntity,
  NotebookProps,
  INotebookRepository,
  NotebookFindOptions,
  NotebookWithCount,
} from '../../../domain';

export interface NotebookRepositoryDeps {
  db: Database;
}

export class NotebookRepository implements INotebookRepository {
  constructor(private readonly deps: NotebookRepositoryDeps) {}

  async findById(id: string): Promise<NotebookProps | null> {
    const result = await this.deps.db.select().from(notebooks).where(eq(notebooks.id, id)).limit(1);

    return result[0] ? this.toNotebookProps(result[0]) : null;
  }

  async findAll(options?: NotebookFindOptions): Promise<NotebookProps[]> {
    const conditions: any[] = [];

    if (options?.workspaceId) {
      conditions.push(eq(notebooks.workspaceId, options.workspaceId));
    }
    if (options?.parentId !== undefined) {
      if (options.parentId === null) {
        conditions.push(isNull(notebooks.parentId));
      } else {
        conditions.push(eq(notebooks.parentId, options.parentId));
      }
    }

    const result = await this.deps.db
      .select()
      .from(notebooks)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return result.map((row) => this.toNotebookProps(row));
  }

  async findAllWithCounts(workspaceId?: string): Promise<NotebookWithCount[]> {
    const conditions: any[] = [];
    if (workspaceId) {
      conditions.push(eq(notebooks.workspaceId, workspaceId));
    }

    const allNotebooks = await this.deps.db
      .select()
      .from(notebooks)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const result: NotebookWithCount[] = [];

    for (const notebook of allNotebooks) {
      const countResult = await this.deps.db
        .select({ count: sql<number>`count(*)` })
        .from(notes)
        .where(and(eq(notes.notebookId, notebook.id), eq(notes.isDeleted, false)));

      result.push({
        ...this.toNotebookProps(notebook),
        noteCount: countResult[0]?.count ?? 0,
      });
    }

    return result;
  }

  async findByWorkspaceId(workspaceId: string): Promise<NotebookProps[]> {
    const result = await this.deps.db
      .select()
      .from(notebooks)
      .where(eq(notebooks.workspaceId, workspaceId));

    return result.map((row) => this.toNotebookProps(row));
  }

  async findByParentId(parentId: string | null, workspaceId?: string): Promise<NotebookProps[]> {
    const conditions: any[] = [];

    if (parentId === null) {
      conditions.push(isNull(notebooks.parentId));
    } else {
      conditions.push(eq(notebooks.parentId, parentId));
    }

    if (workspaceId) {
      conditions.push(eq(notebooks.workspaceId, workspaceId));
    }

    const result = await this.deps.db
      .select()
      .from(notebooks)
      .where(and(...conditions));

    return result.map((row) => this.toNotebookProps(row));
  }

  async findByFolderPath(folderPath: string, workspaceId?: string): Promise<NotebookProps | null> {
    const conditions: any[] = [eq(notebooks.folderPath, folderPath)];

    if (workspaceId) {
      conditions.push(eq(notebooks.workspaceId, workspaceId));
    }

    const result = await this.deps.db
      .select()
      .from(notebooks)
      .where(and(...conditions))
      .limit(1);

    return result[0] ? this.toNotebookProps(result[0]) : null;
  }

  async save(notebook: NotebookEntity): Promise<void> {
    const props = notebook.toPersistence();
    const existing = await this.findById(props.id);

    if (existing) {
      await this.deps.db
        .update(notebooks)
        .set({
          name: props.name,
          parentId: props.parentId,
          workspaceId: props.workspaceId,
          folderPath: props.folderPath,
          icon: props.icon,
          color: props.color,
          position: props.position,
          updatedAt: props.updatedAt,
        })
        .where(eq(notebooks.id, props.id));
    } else {
      await this.deps.db.insert(notebooks).values({
        id: props.id,
        name: props.name,
        parentId: props.parentId,
        workspaceId: props.workspaceId,
        folderPath: props.folderPath,
        icon: props.icon,
        color: props.color,
        position: props.position,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      });
    }
  }

  async delete(id: string): Promise<void> {
    await this.deps.db.delete(notebooks).where(eq(notebooks.id, id));
  }

  async getAncestorIds(id: string): Promise<string[]> {
    const ancestors: string[] = [];
    let currentId: string | null = id;

    while (currentId) {
      const notebook = await this.findById(currentId);
      if (!notebook || !notebook.parentId) break;
      ancestors.push(notebook.parentId);
      currentId = notebook.parentId;
    }

    return ancestors;
  }

  async getDescendantIds(id: string): Promise<string[]> {
    const descendants: string[] = [];
    const queue: string[] = [id];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await this.findByParentId(currentId);

      for (const child of children) {
        descendants.push(child.id);
        queue.push(child.id);
      }
    }

    return descendants;
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.deps.db
      .select({ id: notebooks.id })
      .from(notebooks)
      .where(eq(notebooks.id, id))
      .limit(1);

    return result.length > 0;
  }

  async count(workspaceId?: string): Promise<number> {
    const conditions: any[] = [];

    if (workspaceId) {
      conditions.push(eq(notebooks.workspaceId, workspaceId));
    }

    const result = await this.deps.db
      .select({ count: sql<number>`count(*)` })
      .from(notebooks)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return result[0]?.count ?? 0;
  }

  async updatePositions(updates: Array<{ id: string; position: number }>): Promise<void> {
    for (const { id, position } of updates) {
      await this.deps.db.update(notebooks).set({ position }).where(eq(notebooks.id, id));
    }
  }

  private toNotebookProps(row: typeof notebooks.$inferSelect): NotebookProps {
    return {
      id: row.id,
      name: row.name,
      parentId: row.parentId ?? null,
      workspaceId: row.workspaceId ?? null,
      folderPath: row.folderPath ?? null,
      icon: row.icon ?? '📁',
      color: row.color ?? '#3b82f6',
      position: row.position ?? 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
