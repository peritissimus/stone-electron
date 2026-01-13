/**
 * Workspace API - IPC channel wrappers for workspace operations
 *
 * Implements: specs/api.ts#WorkspaceAPI
 * Pure functions that wrap IPC channels. No React, no stores.
 */

import { z } from 'zod';
import { invokeIpc } from '@renderer/lib/ipc';
import { WORKSPACE_CHANNELS } from '@shared/constants/ipcChannels';
import type { Workspace, IpcResponse } from '@shared/types';
import { validateResponse } from './validation';
import { WorkspaceSchema, FileTreeNodeSchema } from './schemas';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
  noteId?: string;
}

export const workspaceAPI = {
  /**
   * Get all workspaces
   */
  getAll: async (): Promise<IpcResponse<{ workspaces: Workspace[] }>> => {
    const response = await invokeIpc(WORKSPACE_CHANNELS.GET_ALL, {});
    return validateResponse(response, z.object({ workspaces: z.array(WorkspaceSchema) }));
  },

  /**
   * Get the active workspace
   */
  getActive: async (): Promise<IpcResponse<{ workspace?: Workspace }>> => {
    const response = await invokeIpc(WORKSPACE_CHANNELS.GET_ACTIVE, {});
    return validateResponse(response, z.object({ workspace: WorkspaceSchema.optional() }));
  },

  /**
   * Set the active workspace
   */
  setActive: async (id: string): Promise<IpcResponse<Workspace>> => {
    const response = await invokeIpc(WORKSPACE_CHANNELS.SET_ACTIVE, { id });
    return validateResponse(response, WorkspaceSchema);
  },

  /**
   * Create a new workspace
   */
  create: async (data: { name: string; path: string }): Promise<IpcResponse<Workspace>> => {
    const response = await invokeIpc(WORKSPACE_CHANNELS.CREATE, data);
    return validateResponse(response, WorkspaceSchema);
  },

  /**
   * Update a workspace
   */
  update: async (id: string, data: Partial<{ name: string }>): Promise<IpcResponse<Workspace>> => {
    const response = await invokeIpc(WORKSPACE_CHANNELS.UPDATE, { id, ...data });
    return validateResponse(response, WorkspaceSchema);
  },

  /**
   * Delete a workspace
   */
  delete: async (id: string): Promise<IpcResponse<void>> => {
    const response = await invokeIpc(WORKSPACE_CHANNELS.DELETE, { id });
    return validateResponse(response, z.void());
  },

  /**
   * Scan workspace for files
   */
  scan: async (
    workspaceId: string,
  ): Promise<
    IpcResponse<{
      structure: Array<{
        name: string;
        path: string;
        relativePath: string;
        type: 'file' | 'folder';
        children?: any[];
      }>;
      counts?: Record<string, number>;
    }>
  > => {
    const response = await invokeIpc(WORKSPACE_CHANNELS.SCAN, { workspaceId });
    return validateResponse(
      response,
      z.object({
        structure: z.array(
          z.object({
            name: z.string(),
            path: z.string(),
            relativePath: z.string(),
            type: z.enum(['file', 'folder']),
            children: z.array(z.any()).optional(),
          }),
        ),
        counts: z.record(z.number()).optional(),
      }),
    );
  },

  /**
   * Sync workspace with filesystem
   */
  sync: async (
    workspaceId?: string,
  ): Promise<
    IpcResponse<{
      workspaceId: string;
      notebooks: { created: number; updated: number; errors: string[] };
      notes: { created: number; updated: number; deleted: number; errors: string[] };
    }>
  > => {
    const response = await invokeIpc(WORKSPACE_CHANNELS.SYNC, workspaceId ? { workspaceId } : {});
    return validateResponse(
      response,
      z.object({
        workspaceId: z.string(),
        notebooks: z.object({
          created: z.number(),
          updated: z.number(),
          errors: z.array(z.string()),
        }),
        notes: z.object({
          created: z.number(),
          updated: z.number(),
          deleted: z.number(),
          errors: z.array(z.string()),
        }),
      }),
    );
  },

  /**
   * Create a folder in the workspace
   */
  createFolder: async (
    name: string,
    parentPath?: string,
  ): Promise<IpcResponse<{ folderPath: string }>> => {
    const response = await invokeIpc(WORKSPACE_CHANNELS.CREATE_FOLDER, {
      name,
      parentPath,
    });
    return validateResponse(response, z.object({ folderPath: z.string() }));
  },

  /**
   * Rename a folder
   */
  renameFolder: async (
    path: string,
    name: string,
  ): Promise<IpcResponse<{ folderPath: string }>> => {
    const response = await invokeIpc(WORKSPACE_CHANNELS.RENAME_FOLDER, {
      path,
      name,
    });
    return validateResponse(response, z.object({ folderPath: z.string() }));
  },

  /**
   * Delete a folder
   */
  deleteFolder: async (path: string): Promise<IpcResponse<{ success: boolean }>> => {
    const response = await invokeIpc(WORKSPACE_CHANNELS.DELETE_FOLDER, { path });
    return validateResponse(response, z.object({ success: z.boolean() }));
  },

  /**
   * Move a folder
   */
  moveFolder: async (
    sourcePath: string,
    destinationPath: string | null,
  ): Promise<IpcResponse<{ folderPath: string }>> => {
    const response = await invokeIpc(WORKSPACE_CHANNELS.MOVE_FOLDER, {
      sourcePath,
      destinationPath,
    });
    return validateResponse(response, z.object({ folderPath: z.string() }));
  },

  /**
   * Validate a path
   */
  validatePath: async (
    path: string,
  ): Promise<IpcResponse<{ valid: boolean; message?: string }>> => {
    const response = await invokeIpc(WORKSPACE_CHANNELS.VALIDATE_PATH, { path });
    return validateResponse(
      response,
      z.object({ valid: z.boolean(), message: z.string().optional() }),
    );
  },

  /**
   * Open folder selection dialog
   */
  selectFolder: async (): Promise<
    IpcResponse<{ canceled?: boolean; folderPath?: string }>
  > => {
    const response = await invokeIpc(WORKSPACE_CHANNELS.SELECT_FOLDER, {});
    return validateResponse(
      response,
      z.object({ canceled: z.boolean().optional(), folderPath: z.string().optional() }),
    );
  },
};
