/**
 * Git IPC Handlers
 * Handle git operations for workspace sync
 */

import { GIT_CHANNELS } from '@shared/constants/ipcChannels';
import { registerHandler } from '../utils';
import { logger } from '../../utils/logger';
import { getGitService } from '../../services/GitService';
import type { Container } from '../../api/container';
import type { AwilixContainer } from 'awilix';

/**
 * Register all git handlers
 */
export function registerGitHandlers(container: AwilixContainer<Container>) {
  const gitService = getGitService();
  const workspaceRepository = container.resolve('workspaceRepository');

  // Helper to get workspace path
  const getWorkspacePath = async (workspaceId: string): Promise<string | null> => {
    const workspace = await workspaceRepository.findById(workspaceId);
    return workspace?.folderPath || null;
  };

  // git:getStatus
  registerHandler(
    GIT_CHANNELS.GET_STATUS,
    async (_event: unknown, { workspaceId }: { workspaceId: string }) => {
      const workspacePath = await getWorkspacePath(workspaceId);
      if (!workspacePath) {
        throw new Error('Workspace not found');
      }
      return await gitService.getStatus(workspacePath);
    }
  );

  // git:init
  registerHandler(
    GIT_CHANNELS.INIT,
    async (_event: unknown, { workspaceId }: { workspaceId: string }) => {
      const workspacePath = await getWorkspacePath(workspaceId);
      if (!workspacePath) {
        throw new Error('Workspace not found');
      }
      const success = await gitService.init(workspacePath);
      return { success };
    }
  );

  // git:commit
  registerHandler(
    GIT_CHANNELS.COMMIT,
    async (_event: unknown, { workspaceId, message }: { workspaceId: string; message?: string }) => {
      const workspacePath = await getWorkspacePath(workspaceId);
      if (!workspacePath) {
        throw new Error('Workspace not found');
      }
      return await gitService.commit(workspacePath, message);
    }
  );

  // git:pull
  registerHandler(
    GIT_CHANNELS.PULL,
    async (_event: unknown, { workspaceId }: { workspaceId: string }) => {
      const workspacePath = await getWorkspacePath(workspaceId);
      if (!workspacePath) {
        throw new Error('Workspace not found');
      }
      return await gitService.pull(workspacePath);
    }
  );

  // git:push
  registerHandler(
    GIT_CHANNELS.PUSH,
    async (_event: unknown, { workspaceId }: { workspaceId: string }) => {
      const workspacePath = await getWorkspacePath(workspaceId);
      if (!workspacePath) {
        throw new Error('Workspace not found');
      }
      return await gitService.push(workspacePath);
    }
  );

  // git:sync
  registerHandler(
    GIT_CHANNELS.SYNC,
    async (_event: unknown, { workspaceId, message }: { workspaceId: string; message?: string }) => {
      const workspacePath = await getWorkspacePath(workspaceId);
      if (!workspacePath) {
        throw new Error('Workspace not found');
      }
      return await gitService.sync(workspacePath, message);
    }
  );

  // git:setRemote
  registerHandler(
    GIT_CHANNELS.SET_REMOTE,
    async (_event: unknown, { workspaceId, url }: { workspaceId: string; url: string }) => {
      const workspacePath = await getWorkspacePath(workspaceId);
      if (!workspacePath) {
        throw new Error('Workspace not found');
      }
      const success = await gitService.setRemote(workspacePath, url);
      return { success };
    }
  );

  // git:getCommits
  registerHandler(
    GIT_CHANNELS.GET_COMMITS,
    async (_event: unknown, { workspaceId, limit }: { workspaceId: string; limit?: number }) => {
      const workspacePath = await getWorkspacePath(workspaceId);
      if (!workspacePath) {
        throw new Error('Workspace not found');
      }
      const commits = await gitService.getRecentCommits(workspacePath, limit);
      return { commits };
    }
  );

  logger.info('[IPC] Git handlers registered');
}
