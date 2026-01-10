/**
 * Git API - IPC channel wrappers for git operations
 *
 * Pure functions that wrap IPC channels for workspace git sync.
 */

import { invokeIpc } from '@renderer/lib/ipc';
import { GIT_CHANNELS } from '@shared/constants/ipcChannels';
import type { IpcResponse } from '@shared/types';

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
  getStatus: (workspaceId: string): Promise<IpcResponse<GitStatus>> =>
    invokeIpc(GIT_CHANNELS.GET_STATUS, { workspaceId }),

  /**
   * Initialize a git repository in workspace
   */
  init: (workspaceId: string): Promise<IpcResponse<{ success: boolean }>> =>
    invokeIpc(GIT_CHANNELS.INIT, { workspaceId }),

  /**
   * Commit all changes in workspace
   */
  commit: (workspaceId: string, message?: string): Promise<IpcResponse<GitCommitResult>> =>
    invokeIpc(GIT_CHANNELS.COMMIT, { workspaceId, message }),

  /**
   * Pull changes from remote
   */
  pull: (workspaceId: string): Promise<IpcResponse<GitSyncResult>> =>
    invokeIpc(GIT_CHANNELS.PULL, { workspaceId }),

  /**
   * Push changes to remote
   */
  push: (workspaceId: string): Promise<IpcResponse<GitSyncResult>> =>
    invokeIpc(GIT_CHANNELS.PUSH, { workspaceId }),

  /**
   * Full sync: commit, pull, push
   */
  sync: (workspaceId: string, message?: string): Promise<IpcResponse<GitSyncResult>> =>
    invokeIpc(GIT_CHANNELS.SYNC, { workspaceId, message }),

  /**
   * Set remote URL for workspace repo
   */
  setRemote: (workspaceId: string, url: string): Promise<IpcResponse<{ success: boolean }>> =>
    invokeIpc(GIT_CHANNELS.SET_REMOTE, { workspaceId, url }),

  /**
   * Get recent commits
   */
  getCommits: (
    workspaceId: string,
    limit?: number,
  ): Promise<IpcResponse<{ commits: GitCommit[] }>> =>
    invokeIpc(GIT_CHANNELS.GET_COMMITS, { workspaceId, limit }),
};
