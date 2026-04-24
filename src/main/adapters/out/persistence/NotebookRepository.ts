/**
 * Notebook Repository Adapter
 *
 * Implements INotebookRepository port using SQLite via Drizzle ORM.
 */

import { eq, and, isNull, inArray, sql } from 'drizzle-orm';
import { notebooks, notes, type Database } from '../../../shared';
import type {
  NotebookEntity,
  NotebookProps,
  INotebookRepository,
  NotebookFindOptions,
  NotebookWithCount,
} from '../../../domain';
import { handleOperation } from '../../../shared/utils';

export interface NotebookRepositoryDeps {
  db: Database;
}

export class NotebookRepository implements INotebookRepository {
  constructor(private readonly deps: NotebookRepositoryDeps) {}

  private handle<T>(operation: string, fn: () => Promise<T>, context?: Record<string, unknown>) {
    return handleOperation(fn, { adapter: 'NotebookRepository', operation, context });
  }

  async findById(id: string): Promise<NotebookProps | null> {
    return this.handle(
      'findById',
      async () => {
        const result = await this.deps.db
          .select()
          .from(notebooks)
          .where(eq(notebooks.id, id))
          .limit(1);
        return result[0] ? this.toNotebookProps(result[0]) : null;
      },
      { notebookId: id },
    );
  }

  async findAll(options?: NotebookFindOptions): Promise<NotebookProps[]> {
    return this.handle(
      'findAll',
      async () => {
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
      },
      { workspaceId: options?.workspaceId, parentId: options?.parentId },
    );
  }

  async findAllWithCounts(workspaceId?: string): Promise<NotebookWithCount[]> {
    return this.handle(
      'findAllWithCounts',
      async () => {
        const conditions: any[] = [];
        if (workspaceId) {
          conditions.push(eq(notebooks.workspaceId, workspaceId));
        }

        const allNotebooks = await this.deps.db
          .select()
          .from(notebooks)
          .where(conditions.length > 0 ? and(...conditions) : undefined);

        if (allNotebooks.length === 0) {
          return [];
        }

        const notebookIds = allNotebooks.map((notebook) => notebook.id);
        const countRows = await this.deps.db
          .select({
            notebookId: notes.notebookId,
            count: sql<number>`count(*)`,
          })
          .from(notes)
          .where(and(inArray(notes.notebookId, notebookIds), eq(notes.isDeleted, false)))
          .groupBy(notes.notebookId);

        const countByNotebookId = new Map<string, number>();
        for (const row of countRows) {
          if (row.notebookId) {
            countByNotebookId.set(row.notebookId, row.count ?? 0);
          }
        }

        return allNotebooks.map((notebook) => ({
          ...this.toNotebookProps(notebook),
          noteCount: countByNotebookId.get(notebook.id) ?? 0,
        }));
      },
      { workspaceId },
    );
  }

  async findByWorkspaceId(workspaceId: string): Promise<NotebookProps[]> {
    return this.handle(
      'findByWorkspaceId',
      async () => {
        const result = await this.deps.db
          .select()
          .from(notebooks)
          .where(eq(notebooks.workspaceId, workspaceId));

        return result.map((row) => this.toNotebookProps(row));
      },
      { workspaceId },
    );
  }

  async findByParentId(parentId: string | null, workspaceId?: string): Promise<NotebookProps[]> {
    return this.handle(
      'findByParentId',
      async () => {
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
      },
      { parentId, workspaceId },
    );
  }

  async findByFolderPath(folderPath: string, workspaceId?: string): Promise<NotebookProps | null> {
    return this.handle(
      'findByFolderPath',
      async () => {
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
      },
      { folderPath, workspaceId },
    );
  }

  async save(notebook: NotebookEntity): Promise<void> {
    const props = notebook.toPersistence();
    return this.handle(
      'save',
      async () => {
        const existing = await this.deps.db
          .select({ id: notebooks.id })
          .from(notebooks)
          .where(eq(notebooks.id, props.id))
          .limit(1);

        if (existing.length > 0) {
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
      },
      { notebookId: props.id },
    );
  }

  async delete(id: string): Promise<void> {
    return this.handle(
      'delete',
      async () => {
        await this.deps.db.delete(notebooks).where(eq(notebooks.id, id));
      },
      { notebookId: id },
    );
  }

  async getAncestorIds(id: string): Promise<string[]> {
    return this.handle(
      'getAncestorIds',
      async () => {
        const ancestors: string[] = [];
        let currentId: string | null = id;

        while (currentId) {
          const rows = await this.deps.db
            .select()
            .from(notebooks)
            .where(eq(notebooks.id, currentId))
            .limit(1);
          if (rows.length === 0) break;
          const notebook = this.toNotebookProps(rows[0]);
          if (!notebook.parentId) break;
          ancestors.push(notebook.parentId);
          currentId = notebook.parentId;
        }

        return ancestors;
      },
      { notebookId: id },
    );
  }

  async getDescendantIds(id: string): Promise<string[]> {
    return this.handle(
      'getDescendantIds',
      async () => {
        const descendants: string[] = [];
        const queue: string[] = [id];

        while (queue.length > 0) {
          const currentId = queue.shift()!;
          const conditions: any[] = [eq(notebooks.parentId, currentId)];
          const result = await this.deps.db
            .select()
            .from(notebooks)
            .where(and(...conditions));
          const children = result.map((row) => this.toNotebookProps(row));

          for (const child of children) {
            descendants.push(child.id);
            queue.push(child.id);
          }
        }

        return descendants;
      },
      { notebookId: id },
    );
  }

  async exists(id: string): Promise<boolean> {
    return this.handle(
      'exists',
      async () => {
        const result = await this.deps.db
          .select({ id: notebooks.id })
          .from(notebooks)
          .where(eq(notebooks.id, id))
          .limit(1);

        return result.length > 0;
      },
      { notebookId: id },
    );
  }

  async count(workspaceId?: string): Promise<number> {
    return this.handle(
      'count',
      async () => {
        const conditions: any[] = [];

        if (workspaceId) {
          conditions.push(eq(notebooks.workspaceId, workspaceId));
        }

        const result = await this.deps.db
          .select({ count: sql<number>`count(*)` })
          .from(notebooks)
          .where(conditions.length > 0 ? and(...conditions) : undefined);

        return result[0]?.count ?? 0;
      },
      { workspaceId },
    );
  }

  async updatePositions(updates: Array<{ id: string; position: number }>): Promise<void> {
    return this.handle(
      'updatePositions',
      async () => {
        for (const { id, position } of updates) {
          await this.deps.db.update(notebooks).set({ position }).where(eq(notebooks.id, id));
        }
      },
      { count: updates.length },
    );
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
