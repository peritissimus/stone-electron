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
import {
  FolderPathResponseSchema,
  GetActiveWorkspaceResponseSchema,
  ListWorkspacesResponseSchema,
  ScanWorkspaceResponseSchema,
  SelectFolderResponseSchema,
  SyncWorkspaceResponseSchema,
  ValidatePathResponseSchema,
  WorkspaceSchema,
} from '@shared/schemas';
import { validateResponse } from './validation';

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
    return validateResponse(response, ListWorkspacesResponseSchema);
  },

  /**
   * Get the active workspace
   */
  getActive: async (): Promise<IpcResponse<{ workspace?: Workspace | null }>> => {
    const response = await invokeIpc(WORKSPACE_CHANNELS.GET_ACTIVE, {});
    return validateResponse(response, GetActiveWorkspaceResponseSchema);
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
    return validateResponse(response, ScanWorkspaceResponseSchema);
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
    return validateResponse(response, SyncWorkspaceResponseSchema);
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
    return validateResponse(response, FolderPathResponseSchema);
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
    return validateResponse(response, FolderPathResponseSchema);
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
    return validateResponse(response, FolderPathResponseSchema);
  },

  /**
   * Validate a path
   */
  validatePath: async (
    path: string,
  ): Promise<IpcResponse<{ valid: boolean; message?: string }>> => {
    const response = await invokeIpc(WORKSPACE_CHANNELS.VALIDATE_PATH, { path });
    return validateResponse(response, ValidatePathResponseSchema);
  },

  /**
   * Open folder selection dialog
   */
  selectFolder: async (): Promise<
    IpcResponse<{ canceled?: boolean; folderPath?: string }>
  > => {
    const response = await invokeIpc(WORKSPACE_CHANNELS.SELECT_FOLDER, {});
    return validateResponse(response, SelectFolderResponseSchema);
  },
};
