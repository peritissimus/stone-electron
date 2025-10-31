/**
 * WorkspaceRepository - Handles all workspace-related database operations
 */

import { eq, desc } from 'drizzle-orm';
import { getDatabaseManager } from '../database/DatabaseManager';
import { workspaces } from '../database/schema';
import type { Workspace } from '@shared/types';
import { generateId } from '@shared/utils/id';

/**
 * Workspace Repository
 */
export class WorkspaceRepository {
  private db = getDatabaseManager().getDrizzle();

  /**
   * Find all workspaces
   */
  async findAll(): Promise<Workspace[]> {
    const result = await this.db
      .select()
      .from(workspaces)
      .orderBy(desc(workspaces.lastAccessedAt));
    return result as Workspace[];
  }

  /**
   * Find a workspace by ID
   */
  async findById(id: string): Promise<Workspace | null> {
    const result = await this.db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);

    if (result.length === 0) return null;

    return result[0];
  }

  /**
   * Find a workspace by folder path
   */
  async findByFolderPath(folderPath: string): Promise<Workspace | null> {
    const result = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.folderPath, folderPath))
      .limit(1);

    if (result.length === 0) return null;

    return result[0];
  }

  /**
   * Get the active workspace
   */
  async getActive(): Promise<Workspace | null> {
    const result = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.isActive, true))
      .limit(1);

    if (result.length === 0) return null;

    return result[0];
  }

  /**
   * Create a new workspace
   */
  async create(data: { name: string; folderPath: string }): Promise<Workspace> {
    const id = generateId();
    const now = new Date();

    // Check if folder path already exists
    const existing = await this.findByFolderPath(data.folderPath);
    if (existing) {
      throw new Error('Workspace with this folder path already exists');
    }

    const workspaceData = {
      id,
      name: data.name,
      folderPath: data.folderPath,
      isActive: false,
      createdAt: now,
      lastAccessedAt: now,
    };

    await this.db.insert(workspaces).values(workspaceData);

    const result = await this.findById(id);
    if (!result) throw new Error('Failed to create workspace');
    return result;
  }

  /**
   * Update a workspace
   */
  async update(id: string, data: Partial<Workspace>): Promise<Workspace> {
    const updateData = { ...data };

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    await this.db.update(workspaces).set(updateData).where(eq(workspaces.id, id));

    const result = await this.findById(id);
    if (!result) throw new Error('Workspace not found after update');
    return result;
  }

  /**
   * Delete a workspace
   */
  async delete(id: string): Promise<boolean> {
    await this.db.delete(workspaces).where(eq(workspaces.id, id));
    return true;
  }

  /**
   * Set a workspace as active (and deactivate all others)
   */
  async setActive(id: string): Promise<Workspace> {
    // Deactivate all workspaces
    const allWorkspaces = await this.findAll();
    for (const workspace of allWorkspaces) {
      if (workspace.isActive) {
        await this.db
          .update(workspaces)
          .set({ isActive: false })
          .where(eq(workspaces.id, workspace.id));
      }
    }

    // Activate the selected workspace and update last accessed
    const now = new Date();
    await this.db
      .update(workspaces)
      .set({ isActive: true, lastAccessedAt: now })
      .where(eq(workspaces.id, id));

    const result = await this.findById(id);
    if (!result) throw new Error('Workspace not found');
    return result;
  }

  /**
   * Update last accessed timestamp
   */
  async updateLastAccessed(id: string): Promise<void> {
    const now = new Date();
    await this.db
      .update(workspaces)
      .set({ lastAccessedAt: now })
      .where(eq(workspaces.id, id));
  }

  /**
   * Count workspaces
   */
  async count(): Promise<number> {
    const results = await this.findAll();
    return results.length;
  }
}
