/**
 * Workspace API - IPC channel wrappers for workspace operations
 *
 * Implements: specs/api.ts#WorkspaceAPI
 * Pure functions that wrap IPC channels. No React, no stores.
 */

import { invokeIpc } from '@renderer/lib/ipc';
import { WORKSPACE_CHANNELS } from '@shared/constants/ipcChannels';
import type { Workspace, IpcResponse } from '@shared/types';

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
  getAll: (): Promise<IpcResponse<{ workspaces: Workspace[] }>> =>
    invokeIpc(WORKSPACE_CHANNELS.GET_ALL, {}),

  /**
   * Get the active workspace
   */
  getActive: (): Promise<IpcResponse<{ workspace?: Workspace }>> =>
    invokeIpc(WORKSPACE_CHANNELS.GET_ACTIVE, {}),

  /**
   * Set the active workspace
   */
  setActive: (id: string): Promise<IpcResponse<Workspace>> =>
    invokeIpc(WORKSPACE_CHANNELS.SET_ACTIVE, { id }),

  /**
   * Create a new workspace
   */
  create: (data: {
    name: string;
    path: string;
  }): Promise<IpcResponse<Workspace>> =>
    invokeIpc(WORKSPACE_CHANNELS.CREATE, data),

  /**
   * Update a workspace
   */
  update: (
    id: string,
    data: Partial<{ name: string }>
  ): Promise<IpcResponse<Workspace>> =>
    invokeIpc(WORKSPACE_CHANNELS.UPDATE, { id, ...data }),

  /**
   * Delete a workspace
   */
  delete: (id: string): Promise<IpcResponse<void>> =>
    invokeIpc(WORKSPACE_CHANNELS.DELETE, { id }),

  /**
   * Scan workspace for files
   */
  scan: (workspaceId: string): Promise<IpcResponse<{
    structure: Array<{
      name: string;
      path: string;
      relativePath: string;
      type: 'file' | 'folder';
      children?: any[];
    }>;
    counts?: Record<string, number>;
  }>> =>
    invokeIpc(WORKSPACE_CHANNELS.SCAN, { workspaceId }),

  /**
   * Sync workspace with filesystem
   */
  sync: (workspaceId?: string): Promise<IpcResponse<{
    workspaceId: string;
    notebooks: { created: number; updated: number; errors: string[] };
    notes: { created: number; updated: number; deleted: number; errors: string[] };
  }>> =>
    invokeIpc(WORKSPACE_CHANNELS.SYNC, workspaceId ? { workspaceId } : {}),

  /**
   * Create a folder in the workspace
   */
  createFolder: (
    name: string,
    parentPath?: string
  ): Promise<IpcResponse<{ folderPath: string }>> =>
    invokeIpc(WORKSPACE_CHANNELS.CREATE_FOLDER, {
      name,
      parentPath,
    }),

  /**
   * Rename a folder
   */
  renameFolder: (
    path: string,
    name: string
  ): Promise<IpcResponse<{ folderPath: string }>> =>
    invokeIpc(WORKSPACE_CHANNELS.RENAME_FOLDER, {
      path,
      name,
    }),

  /**
   * Delete a folder
   */
  deleteFolder: (path: string): Promise<IpcResponse<{ success: boolean }>> =>
    invokeIpc(WORKSPACE_CHANNELS.DELETE_FOLDER, { path }),

  /**
   * Move a folder
   */
  moveFolder: (
    sourcePath: string,
    destinationPath: string | null
  ): Promise<IpcResponse<{ folderPath: string }>> =>
    invokeIpc(WORKSPACE_CHANNELS.MOVE_FOLDER, {
      sourcePath,
      destinationPath,
    }),

  /**
   * Validate a path
   */
  validatePath: (path: string): Promise<IpcResponse<{ valid: boolean; message?: string }>> =>
    invokeIpc(WORKSPACE_CHANNELS.VALIDATE_PATH, { path }),

  /**
   * Open folder selection dialog
   */
  selectFolder: (): Promise<IpcResponse<{ canceled?: boolean; folderPath?: string }>> =>
    invokeIpc(WORKSPACE_CHANNELS.SELECT_FOLDER, {}),
};
