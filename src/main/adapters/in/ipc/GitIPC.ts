/**
 * Git IPC Adapter - Handles Git operations IPC channels
 */

import { ipcMain } from 'electron';
import type { Effect } from 'effect';
import { GIT_CHANNELS } from '@shared/constants/ipcChannels';
import {
  GetGitCommitsRequestSchema,
  GitMessageRequestSchema,
  GitWorkspaceIdRequestSchema,
  SetGitRemoteRequestSchema,
} from '@shared/schemas';
import type { IGitUseCases } from '../../../domain';
import { handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface GitIPCDeps {
  runGitEffect: RunGitEffect;
}

export type RunGitEffect = <A, E>(
  use: (service: IGitUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

const mapGitErrorCode = (error: unknown): string | undefined => {
  if (error instanceof Error) {
    if (error.name === 'NoChangesError') return 'NO_CHANGES';
    if (error.name === 'GitNotInitializedError') return 'GIT_NOT_INITIALIZED';
  }
  return undefined;
};

export function registerGitHandlers(deps: GitIPCDeps): void {
  const run = deps.runGitEffect;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, {
      loggerPrefix: 'GitIPC',
      defaultCode: 'GIT_ERROR',
      mapErrorCode: mapGitErrorCode,
      context,
    });

  ipcMain.handle(GIT_CHANNELS.GET_STATUS, async (_, rawRequest) => {
    const { workspaceId } = GitWorkspaceIdRequestSchema.parse(rawRequest);
    return handleRequest(
      async () => {
        const status = await run((service) =>
          service.getStatus.execute({ workspaceId }),
        );
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
          lastSyncAt: status.lastSyncAt,
          hasChanges: status.hasChanges,
        };
      },
      { channel: GIT_CHANNELS.GET_STATUS, workspaceId },
    );
  });

  ipcMain.handle(GIT_CHANNELS.INIT, async (_, rawRequest) => {
    const { workspaceId } = GitWorkspaceIdRequestSchema.parse(rawRequest);
    return handleRequest(
      async () => {
        const result = await run((service) =>
          service.init.execute({ workspaceId }),
        );
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
    async (_, rawRequest) => {
      const { workspaceId, message } = GitMessageRequestSchema.parse(rawRequest);
      return handleRequest(
        async () => {
          const result = await run((service) =>
            service.commit.execute({ workspaceId, message }),
          );
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

  ipcMain.handle(GIT_CHANNELS.PULL, async (_, rawRequest) => {
    const { workspaceId } = GitWorkspaceIdRequestSchema.parse(rawRequest);
    return handleRequest(
      async () => {
        const result = await run((service) =>
          service.pull.execute({ workspaceId }),
        );
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

  ipcMain.handle(GIT_CHANNELS.PUSH, async (_, rawRequest) => {
    const { workspaceId } = GitWorkspaceIdRequestSchema.parse(rawRequest);
    return handleRequest(
      async () => {
        const result = await run((service) =>
          service.push.execute({ workspaceId }),
        );
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
    async (_, rawRequest) => {
      const { workspaceId, message } = GitMessageRequestSchema.parse(rawRequest);
      return handleRequest(
        async () =>
          run((service) => service.sync.execute({ workspaceId, message })),
        { channel: GIT_CHANNELS.SYNC, workspaceId },
      );
    },
  );

  ipcMain.handle(
    GIT_CHANNELS.SET_REMOTE,
    async (_, rawRequest) => {
      const { workspaceId, url } = SetGitRemoteRequestSchema.parse(rawRequest);
      return handleRequest(
        async () => {
          const result = await run((service) =>
            service.setRemote.execute({ workspaceId, url }),
          );
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
    async (_, rawRequest) => {
      const { workspaceId, limit } = GetGitCommitsRequestSchema.parse(rawRequest);
      return handleRequest(
        async () => {
          const result = await run((service) =>
            service.getCommits.execute({ workspaceId, limit }),
          );
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
