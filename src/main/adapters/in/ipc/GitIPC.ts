/**
 * Git IPC Adapter - Handles Git operations IPC channels
 */

import { ipcMain } from 'electron';
import { GIT_CHANNELS } from '@shared/constants/ipcChannels';
import type {
  IGetGitStatusUseCase,
  IInitGitRepoUseCase,
  IGitCommitUseCase,
  IGitPullUseCase,
  IGitPushUseCase,
  IGitSyncUseCase,
  ISetGitRemoteUseCase,
  IGetGitCommitsUseCase,
} from '../../../domain';
import { handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface GitIPCDeps {
  getGitStatus: IGetGitStatusUseCase;
  initGitRepo: IInitGitRepoUseCase;
  gitCommit: IGitCommitUseCase;
  gitPull: IGitPullUseCase;
  gitPush: IGitPushUseCase;
  gitSync: IGitSyncUseCase;
  setGitRemote: ISetGitRemoteUseCase;
  getGitCommits: IGetGitCommitsUseCase;
}

const mapGitErrorCode = (error: unknown): string | undefined => {
  if (error instanceof Error) {
    if (error.name === 'NoChangesError') return 'NO_CHANGES';
    if (error.name === 'GitNotInitializedError') return 'GIT_NOT_INITIALIZED';
  }
  return undefined;
};

export function registerGitHandlers(deps: GitIPCDeps): void {
  const {
    getGitStatus,
    initGitRepo,
    gitCommit,
    gitPull,
    gitPush,
    gitSync,
    setGitRemote,
    getGitCommits,
  } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, {
      loggerPrefix: 'GitIPC',
      defaultCode: 'GIT_ERROR',
      mapErrorCode: mapGitErrorCode,
      context,
    });

  ipcMain.handle(GIT_CHANNELS.GET_STATUS, async (_, { workspaceId }: { workspaceId: string }) => {
    return handleRequest(
      async () => {
        const status = await getGitStatus.execute({ workspaceId });
        // Transform domain response to frontend-expected format
        return {
          isRepo: status.isRepo,
          branch: status.branch,
          hasRemote: !!status.remote,
          remoteUrl: status.remote,
          ahead: status.ahead,
          behind: status.behind,
          staged: status.staged.length,
          unstaged: status.modified.length,
          untracked: status.untracked.length,
          hasChanges: status.hasChanges,
        };
      },
      { channel: GIT_CHANNELS.GET_STATUS, workspaceId },
    );
  });

  ipcMain.handle(GIT_CHANNELS.INIT, async (_, { workspaceId }: { workspaceId: string }) => {
    return handleRequest(
      async () => {
        const result = await initGitRepo.execute({ workspaceId });
        if (!result.success) {
          const error = new Error('Failed to initialize git repository');
          error.name = 'GitOperationError';
          throw error;
        }
        return { success: true };
      },
      { channel: GIT_CHANNELS.INIT, workspaceId },
    );
  });

  ipcMain.handle(
    GIT_CHANNELS.COMMIT,
    async (_, { workspaceId, message }: { workspaceId: string; message?: string }) => {
      return handleRequest(
        async () => {
          const result = await gitCommit.execute({ workspaceId, message });
          if (!result) {
            const error = new Error('No changes to commit');
            error.name = 'NoChangesError';
            throw error;
          }
          return {
            ...result,
            date: result.date.toISOString(),
          };
        },
        { channel: GIT_CHANNELS.COMMIT, workspaceId },
      );
    },
  );

  ipcMain.handle(GIT_CHANNELS.PULL, async (_, { workspaceId }: { workspaceId: string }) => {
    return handleRequest(
      async () => {
        const result = await gitPull.execute({ workspaceId });
        if (!result.success) {
          const error = new Error(result.error || 'Pull failed');
          error.name = 'GitOperationError';
          throw error;
        }
        return { success: true };
      },
      { channel: GIT_CHANNELS.PULL, workspaceId },
    );
  });

  ipcMain.handle(GIT_CHANNELS.PUSH, async (_, { workspaceId }: { workspaceId: string }) => {
    return handleRequest(
      async () => {
        const result = await gitPush.execute({ workspaceId });
        if (!result.success) {
          const error = new Error(result.error || 'Push failed');
          error.name = 'GitOperationError';
          throw error;
        }
        return { success: true };
      },
      { channel: GIT_CHANNELS.PUSH, workspaceId },
    );
  });

  ipcMain.handle(
    GIT_CHANNELS.SYNC,
    async (_, { workspaceId, message }: { workspaceId: string; message?: string }) => {
      return handleRequest(
        async () => gitSync.execute({ workspaceId, message }),
        { channel: GIT_CHANNELS.SYNC, workspaceId },
      );
    },
  );

  ipcMain.handle(
    GIT_CHANNELS.SET_REMOTE,
    async (_, { workspaceId, url }: { workspaceId: string; url: string }) => {
      return handleRequest(
        async () => {
          const result = await setGitRemote.execute({ workspaceId, url });
          if (!result.success) {
            const error = new Error('Failed to set remote');
            error.name = 'GitOperationError';
            throw error;
          }
          return { success: true };
        },
        { channel: GIT_CHANNELS.SET_REMOTE, workspaceId },
      );
    },
  );

  ipcMain.handle(
    GIT_CHANNELS.GET_COMMITS,
    async (_, { workspaceId, limit }: { workspaceId: string; limit?: number }) => {
      return handleRequest(
        async () => {
          const result = await getGitCommits.execute({ workspaceId, limit });
          return {
            commits: result.commits.map((c) => ({
              ...c,
              date: c.date.toISOString(),
            })),
          };
        },
        { channel: GIT_CHANNELS.GET_COMMITS, workspaceId, limit },
      );
    },
  );

  logger.info('[IPC] Git handlers registered');
}

export function unregisterGitHandlers(): void {
  Object.values(GIT_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
