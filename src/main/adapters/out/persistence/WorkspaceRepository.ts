/**
 * Workspace Repository Adapter
 *
 * Implements IWorkspaceRepository port using SQLite via Drizzle ORM.
 */

import { eq } from 'drizzle-orm';
import { workspaces, type Database } from '../../../shared';
import type { WorkspaceEntity, WorkspaceProps, IWorkspaceRepository } from '../../../domain';
import { handleOperation } from '../../../shared/utils';

export interface WorkspaceRepositoryDeps {
  db: Database;
}

export class WorkspaceRepository implements IWorkspaceRepository {
  constructor(private readonly deps: WorkspaceRepositoryDeps) {}

  private handle<T>(operation: string, fn: () => Promise<T>, context?: Record<string, unknown>) {
    return handleOperation(fn, { adapter: 'WorkspaceRepository', operation, context });
  }

  async findById(id: string): Promise<WorkspaceProps | null> {
    return this.handle(
      'findById',
      async () => {
        const result = await this.deps.db
          .select()
          .from(workspaces)
          .where(eq(workspaces.id, id))
          .limit(1);

        return result[0] ? this.toWorkspaceProps(result[0]) : null;
      },
      { workspaceId: id },
    );
  }

  async findByFolderPath(folderPath: string): Promise<WorkspaceProps | null> {
    return this.handle(
      'findByFolderPath',
      async () => {
        const result = await this.deps.db
          .select()
          .from(workspaces)
          .where(eq(workspaces.folderPath, folderPath))
          .limit(1);

        return result[0] ? this.toWorkspaceProps(result[0]) : null;
      },
      { folderPath },
    );
  }

  async findAll(): Promise<WorkspaceProps[]> {
    return this.handle('findAll', async () => {
      const result = await this.deps.db.select().from(workspaces);
      return result.map((row) => this.toWorkspaceProps(row));
    });
  }

  async findActive(): Promise<WorkspaceProps | null> {
    return this.handle('findActive', async () => {
      const result = await this.deps.db
        .select()
        .from(workspaces)
        .where(eq(workspaces.isActive, true))
        .limit(1);

      return result[0] ? this.toWorkspaceProps(result[0]) : null;
    });
  }

  async save(workspace: WorkspaceEntity): Promise<void> {
    const props = workspace.toPersistence();
    return this.handle(
      'save',
      async () => {
        const existing = await this.deps.db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.id, props.id))
          .limit(1);

        if (existing.length > 0) {
          await this.deps.db
            .update(workspaces)
            .set({
              name: props.name,
              folderPath: props.folderPath,
              isActive: props.isActive,
              lastAccessedAt: new Date(),
            })
            .where(eq(workspaces.id, props.id));
        } else {
          await this.deps.db.insert(workspaces).values({
            id: props.id,
            name: props.name,
            folderPath: props.folderPath,
            isActive: props.isActive,
            createdAt: props.createdAt,
            lastAccessedAt: new Date(),
          });
        }
      },
      { workspaceId: props.id, name: props.name },
    );
  }

  async delete(id: string): Promise<void> {
    return this.handle(
      'delete',
      async () => {
        await this.deps.db.delete(workspaces).where(eq(workspaces.id, id));
      },
      { workspaceId: id },
    );
  }

  async setActive(id: string): Promise<void> {
    return this.handle(
      'setActive',
      async () => {
        // Deactivate all workspaces
        await this.deps.db.update(workspaces).set({ isActive: false });

        // Activate the specified workspace
        await this.deps.db
          .update(workspaces)
          .set({ isActive: true, lastAccessedAt: new Date() })
          .where(eq(workspaces.id, id));
      },
      { workspaceId: id },
    );
  }

  async exists(id: string): Promise<boolean> {
    return this.handle(
      'exists',
      async () => {
        const result = await this.deps.db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.id, id))
          .limit(1);

        return result.length > 0;
      },
      { workspaceId: id },
    );
  }

  private toWorkspaceProps(row: typeof workspaces.$inferSelect): WorkspaceProps {
    return {
      id: row.id,
      name: row.name,
      folderPath: row.folderPath,
      isActive: row.isActive ?? false,
      createdAt: row.createdAt,
      lastAccessedAt: row.lastAccessedAt,
    };
  }
}
