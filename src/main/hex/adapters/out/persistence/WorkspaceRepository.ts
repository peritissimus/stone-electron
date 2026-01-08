/**
 * Workspace Repository Adapter
 *
 * Implements IWorkspaceRepository port using SQLite via Drizzle ORM.
 */

import { eq } from 'drizzle-orm';
import { workspaces, type Database } from '../../../infrastructure/database';
import type { WorkspaceEntity, WorkspaceProps } from '../../../domain/entities';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';

export interface WorkspaceRepositoryDeps {
  db: Database;
}

export class WorkspaceRepository implements IWorkspaceRepository {
  constructor(private readonly deps: WorkspaceRepositoryDeps) {}

  async findById(id: string): Promise<WorkspaceProps | null> {
    const result = await this.deps.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1);

    return result[0] ? this.toWorkspaceProps(result[0]) : null;
  }

  async findByFolderPath(folderPath: string): Promise<WorkspaceProps | null> {
    const result = await this.deps.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.folderPath, folderPath))
      .limit(1);

    return result[0] ? this.toWorkspaceProps(result[0]) : null;
  }

  async findAll(): Promise<WorkspaceProps[]> {
    const result = await this.deps.db.select().from(workspaces);
    return result.map((row) => this.toWorkspaceProps(row));
  }

  async findActive(): Promise<WorkspaceProps | null> {
    const result = await this.deps.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.isActive, true))
      .limit(1);

    return result[0] ? this.toWorkspaceProps(result[0]) : null;
  }

  async save(workspace: WorkspaceEntity): Promise<void> {
    const props = workspace.toPersistence();
    const existing = await this.findById(props.id);

    if (existing) {
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
  }

  async delete(id: string): Promise<void> {
    await this.deps.db.delete(workspaces).where(eq(workspaces.id, id));
  }

  async setActive(id: string): Promise<void> {
    // Deactivate all workspaces
    await this.deps.db.update(workspaces).set({ isActive: false });

    // Activate the specified workspace
    await this.deps.db
      .update(workspaces)
      .set({ isActive: true, lastAccessedAt: new Date() })
      .where(eq(workspaces.id, id));
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.deps.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1);

    return result.length > 0;
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
