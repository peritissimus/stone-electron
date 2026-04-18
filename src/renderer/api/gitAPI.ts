/**
 * Git API - IPC channel wrappers for git operations
 *
 * Pure functions that wrap IPC channels for workspace git sync.
 * No spec counterpart: git sync is desktop-only.
 */

import { z } from 'zod';
import { invokeIpc } from '@renderer/lib/ipc';
import { GIT_CHANNELS } from '@shared/constants/ipcChannels';
import type { IpcResponse } from '@shared/types';
import { validateResponse } from './validation';
import {
  GitStatusSchema,
  GitCommitResultSchema,
  GitSyncResultSchema,
  GitCommitSchema,
} from './schemas';

export interface GitStatus {
  isRepo: boolean;
  branch: string | null;
  hasRemote: boolean;
  remoteUrl: string | null;
  ahead: number;
  behind: number;
  staged: number;
  unstaged: number;
  untracked: number;
  hasChanges: boolean;
}

export interface GitCommitResult {
  success: boolean;
  hash?: string;
  message?: string;
  error?: string;
}

export interface GitSyncResult {
  success: boolean;
  pulled?: number;
  pushed?: number;
  error?: string;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export const gitAPI = {
  /**
   * Get git status for a workspace
   */
  getStatus: async (workspaceId: string): Promise<IpcResponse<GitStatus>> => {
    const response = await invokeIpc(GIT_CHANNELS.GET_STATUS, { workspaceId });
    return validateResponse(response, GitStatusSchema);
  },

  /**
   * Initialize a git repository in workspace
   */
  init: async (workspaceId: string): Promise<IpcResponse<{ success: boolean }>> => {
    const response = await invokeIpc(GIT_CHANNELS.INIT, { workspaceId });
    return validateResponse(response, z.object({ success: z.boolean() }));
  },

  /**
   * Commit all changes in workspace
   */
  commit: async (
    workspaceId: string,
    message?: string,
  ): Promise<IpcResponse<GitCommitResult>> => {
    const response = await invokeIpc(GIT_CHANNELS.COMMIT, { workspaceId, message });
    return validateResponse(response, GitCommitResultSchema);
  },

  /**
   * Pull changes from remote
   */
  pull: async (workspaceId: string): Promise<IpcResponse<GitSyncResult>> => {
    const response = await invokeIpc(GIT_CHANNELS.PULL, { workspaceId });
    return validateResponse(response, GitSyncResultSchema);
  },

  /**
   * Push changes to remote
   */
  push: async (workspaceId: string): Promise<IpcResponse<GitSyncResult>> => {
    const response = await invokeIpc(GIT_CHANNELS.PUSH, { workspaceId });
    return validateResponse(response, GitSyncResultSchema);
  },

  /**
   * Full sync: commit, pull, push
   */
  sync: async (workspaceId: string, message?: string): Promise<IpcResponse<GitSyncResult>> => {
    const response = await invokeIpc(GIT_CHANNELS.SYNC, { workspaceId, message });
    return validateResponse(response, GitSyncResultSchema);
  },

  /**
   * Set remote URL for workspace repo
   */
  setRemote: async (
    workspaceId: string,
    url: string,
  ): Promise<IpcResponse<{ success: boolean }>> => {
    const response = await invokeIpc(GIT_CHANNELS.SET_REMOTE, { workspaceId, url });
    return validateResponse(response, z.object({ success: z.boolean() }));
  },

  /**
   * Get recent commits
   */
  getCommits: async (
    workspaceId: string,
    limit?: number,
  ): Promise<IpcResponse<{ commits: GitCommit[] }>> => {
    const response = await invokeIpc(GIT_CHANNELS.GET_COMMITS, { workspaceId, limit });
    return validateResponse(response, z.object({ commits: z.array(GitCommitSchema) }));
  },
};
