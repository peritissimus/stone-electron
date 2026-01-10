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
import { handleIpcRequest } from './ipcUtils';
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

  ipcMain.handle(GIT_CHANNELS.GET_STATUS, async (_, { workspaceId }: { workspaceId: string }) => {
    logger.info('[IPC] git:getStatus', { workspaceId });
    return handleIpcRequest(
      async () => getGitStatus.execute({ workspaceId }),
      { loggerPrefix: GIT_CHANNELS.GET_STATUS, defaultCode: 'GIT_ERROR', mapErrorCode: mapGitErrorCode },
    );
  });

  ipcMain.handle(GIT_CHANNELS.INIT, async (_, { workspaceId }: { workspaceId: string }) => {
    logger.info('[IPC] git:init', { workspaceId });
    return handleIpcRequest(
      async () => {
        const result = await initGitRepo.execute({ workspaceId });
        if (!result.success) {
          const error = new Error('Failed to initialize git repository');
          error.name = 'GitOperationError';
          throw error;
        }
        return { success: true };
      },
      { loggerPrefix: GIT_CHANNELS.INIT, defaultCode: 'GIT_ERROR', mapErrorCode: mapGitErrorCode },
    );
  });

  ipcMain.handle(
    GIT_CHANNELS.COMMIT,
    async (_, { workspaceId, message }: { workspaceId: string; message?: string }) => {
      logger.info('[IPC] git:commit', { workspaceId, message });
      return handleIpcRequest(
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
        { loggerPrefix: GIT_CHANNELS.COMMIT, defaultCode: 'GIT_ERROR', mapErrorCode: mapGitErrorCode },
      );
    },
  );

  ipcMain.handle(GIT_CHANNELS.PULL, async (_, { workspaceId }: { workspaceId: string }) => {
    logger.info('[IPC] git:pull', { workspaceId });
    return handleIpcRequest(
      async () => {
        const result = await gitPull.execute({ workspaceId });
        if (!result.success) {
          const error = new Error(result.error || 'Pull failed');
          error.name = 'GitOperationError';
          throw error;
        }
        return { success: true };
      },
      { loggerPrefix: GIT_CHANNELS.PULL, defaultCode: 'GIT_ERROR', mapErrorCode: mapGitErrorCode },
    );
  });

  ipcMain.handle(GIT_CHANNELS.PUSH, async (_, { workspaceId }: { workspaceId: string }) => {
    logger.info('[IPC] git:push', { workspaceId });
    return handleIpcRequest(
      async () => {
        const result = await gitPush.execute({ workspaceId });
        if (!result.success) {
          const error = new Error(result.error || 'Push failed');
          error.name = 'GitOperationError';
          throw error;
        }
        return { success: true };
      },
      { loggerPrefix: GIT_CHANNELS.PUSH, defaultCode: 'GIT_ERROR', mapErrorCode: mapGitErrorCode },
    );
  });

  ipcMain.handle(
    GIT_CHANNELS.SYNC,
    async (_, { workspaceId, message }: { workspaceId: string; message?: string }) => {
      logger.info('[IPC] git:sync', { workspaceId, message });
      return handleIpcRequest(
        async () => gitSync.execute({ workspaceId, message }),
        { loggerPrefix: GIT_CHANNELS.SYNC, defaultCode: 'GIT_ERROR', mapErrorCode: mapGitErrorCode },
      );
    },
  );

  ipcMain.handle(
    GIT_CHANNELS.SET_REMOTE,
    async (_, { workspaceId, url }: { workspaceId: string; url: string }) => {
      logger.info('[IPC] git:setRemote', { workspaceId, url });
      return handleIpcRequest(
        async () => {
          const result = await setGitRemote.execute({ workspaceId, url });
          if (!result.success) {
            const error = new Error('Failed to set remote');
            error.name = 'GitOperationError';
            throw error;
          }
          return { success: true };
        },
        { loggerPrefix: GIT_CHANNELS.SET_REMOTE, defaultCode: 'GIT_ERROR', mapErrorCode: mapGitErrorCode },
      );
    },
  );

  ipcMain.handle(
    GIT_CHANNELS.GET_COMMITS,
    async (_, { workspaceId, limit }: { workspaceId: string; limit?: number }) => {
      logger.info('[IPC] git:getCommits', { workspaceId, limit });
      return handleIpcRequest(
        async () => {
          const result = await getGitCommits.execute({ workspaceId, limit });
          return {
            commits: result.commits.map((c) => ({
              ...c,
              date: c.date.toISOString(),
            })),
          };
        },
        { loggerPrefix: GIT_CHANNELS.GET_COMMITS, defaultCode: 'GIT_ERROR', mapErrorCode: mapGitErrorCode },
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
