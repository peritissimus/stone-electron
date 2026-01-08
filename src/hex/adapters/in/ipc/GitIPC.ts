/**
 * Git IPC Adapter - Handles Git operations IPC channels
 */

import { ipcMain } from 'electron';
import type {
  IGetGitStatusUseCase,
  IInitGitRepoUseCase,
  IGitCommitUseCase,
  IGitPullUseCase,
  IGitPushUseCase,
  IGitSyncUseCase,
  ISetGitRemoteUseCase,
  IGetGitCommitsUseCase,
} from '../../../domain/ports/in/IGitUseCases';
import { logger } from '../../../shared/utils';

const CHANNELS = {
  STATUS: 'git:status',
  INIT: 'git:init',
  COMMIT: 'git:commit',
  PULL: 'git:pull',
  PUSH: 'git:push',
  SYNC: 'git:sync',
  SET_REMOTE: 'git:setRemote',
  GET_COMMITS: 'git:getCommits',
} as const;

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

  ipcMain.handle(CHANNELS.STATUS, async (_, workspaceId: string) => {
    try {
      logger.info('[IPC] git:status', { workspaceId });
      const status = await getGitStatus.execute({ workspaceId });
      return { success: true, data: status };
    } catch (error) {
      logger.error('[IPC] git:status error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle(CHANNELS.INIT, async (_, workspaceId: string) => {
    try {
      logger.info('[IPC] git:init', { workspaceId });
      const result = await initGitRepo.execute({ workspaceId });
      return { success: result.success };
    } catch (error) {
      logger.error('[IPC] git:init error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle(
    CHANNELS.COMMIT,
    async (_, workspaceId: string, message?: string) => {
      try {
        logger.info('[IPC] git:commit', { workspaceId, message });
        const result = await gitCommit.execute({ workspaceId, message });
        if (!result) {
          return { success: false, error: 'No changes to commit' };
        }
        return {
          success: true,
          data: {
            ...result,
            date: result.date.toISOString(),
          },
        };
      } catch (error) {
        logger.error('[IPC] git:commit error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(CHANNELS.PULL, async (_, workspaceId: string) => {
    try {
      logger.info('[IPC] git:pull', { workspaceId });
      const result = await gitPull.execute({ workspaceId });
      return { success: result.success, error: result.error };
    } catch (error) {
      logger.error('[IPC] git:pull error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle(CHANNELS.PUSH, async (_, workspaceId: string) => {
    try {
      logger.info('[IPC] git:push', { workspaceId });
      const result = await gitPush.execute({ workspaceId });
      return { success: result.success, error: result.error };
    } catch (error) {
      logger.error('[IPC] git:push error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle(
    CHANNELS.SYNC,
    async (_, workspaceId: string, message?: string) => {
      try {
        logger.info('[IPC] git:sync', { workspaceId, message });
        const result = await gitSync.execute({ workspaceId, message });
        return { success: true, data: result };
      } catch (error) {
        logger.error('[IPC] git:sync error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANNELS.SET_REMOTE,
    async (_, workspaceId: string, url: string) => {
      try {
        logger.info('[IPC] git:setRemote', { workspaceId, url });
        const result = await setGitRemote.execute({ workspaceId, url });
        return { success: result.success };
      } catch (error) {
        logger.error('[IPC] git:setRemote error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANNELS.GET_COMMITS,
    async (_, workspaceId: string, limit?: number) => {
      try {
        logger.info('[IPC] git:getCommits', { workspaceId, limit });
        const result = await getGitCommits.execute({ workspaceId, limit });
        return {
          success: true,
          data: result.commits.map((c) => ({
            ...c,
            date: c.date.toISOString(),
          })),
        };
      } catch (error) {
        logger.error('[IPC] git:getCommits error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  logger.info('[IPC] Git handlers registered');
}

export function unregisterGitHandlers(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
