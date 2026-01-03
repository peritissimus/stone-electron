/**
 * Workspace IPC Handlers
 *
 * Uses services for business logic, not repositories directly.
 * Pattern: IPC Handler → Service → Repository → Database
 */

import { dialog } from 'electron';
import { WORKSPACE_CHANNELS } from '@shared/constants/ipcChannels';
import { registerHandler, IpcError } from '../utils';
import { logger } from '../../utils/logger';
import type { Container } from '../../api/container';
import type { AwilixContainer } from 'awilix';

/**
 * Register all workspace handlers
 */
export function registerWorkspaceHandlers(container: AwilixContainer<Container>) {
  const workspaceService = container.cradle.workspaceService;

  // workspaces:selectFolder - Dialog handling stays in IPC
  registerHandler(
    WORKSPACE_CHANNELS.SELECT_FOLDER,
    async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Workspace Folder',
        buttonLabel: 'Select Folder',
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }

      return {
        canceled: false,
        folderPath: result.filePaths[0],
      };
    },
  );

  // workspaces:validatePath
  registerHandler(
    WORKSPACE_CHANNELS.VALIDATE_PATH,
    async (event, request: { folderPath: string }) => {
      return workspaceService.validatePath(request.folderPath);
    },
  );

  // workspaces:create
  registerHandler(
    WORKSPACE_CHANNELS.CREATE,
    async (event, request: { name: string; folderPath: string }) => {
      try {
        return await workspaceService.createWorkspace({
          name: request.name,
          folderPath: request.folderPath,
        });
      } catch (error) {
        if (error instanceof Error) {
          throw new IpcError('INVALID_PATH', error.message);
        }
        throw error;
      }
    },
  );

  // workspaces:getAll
  registerHandler(WORKSPACE_CHANNELS.GET_ALL, async () => {
    const workspaces = await workspaceService.getAllWorkspaces();
    return { workspaces };
  });

  // workspaces:getActive
  registerHandler(WORKSPACE_CHANNELS.GET_ACTIVE, async () => {
    const workspace = await workspaceService.getActiveWorkspace();
    return { workspace };
  });

  // workspaces:setActive
  registerHandler(
    WORKSPACE_CHANNELS.SET_ACTIVE,
    async (event, request: { id: string }) => {
      return workspaceService.setActiveWorkspace(request.id);
    },
  );

  // workspaces:update
  registerHandler(
    WORKSPACE_CHANNELS.UPDATE,
    async (event, request: { id: string; name?: string }) => {
      return workspaceService.updateWorkspace(request.id, { name: request.name });
    },
  );

  // workspaces:createFolder
  registerHandler(
    WORKSPACE_CHANNELS.CREATE_FOLDER,
    async (event, request: { name: string; parentPath?: string }) => {
      try {
        return await workspaceService.createFolder(request.name, request.parentPath);
      } catch (error) {
        if (error instanceof Error && error.message.includes('No active workspace')) {
          throw new IpcError('NOT_FOUND', 'Active workspace not found');
        }
        throw error;
      }
    },
  );

  // workspaces:renameFolder
  registerHandler(
    WORKSPACE_CHANNELS.RENAME_FOLDER,
    async (event, request: { path: string; name: string }) => {
      try {
        return await workspaceService.renameFolder(request.path, request.name);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('No active workspace')) {
            throw new IpcError('NOT_FOUND', 'Active workspace not found');
          }
          if (error.message.includes('does not exist')) {
            throw new IpcError('NOT_FOUND', error.message);
          }
          if (error.message.includes('required')) {
            throw new IpcError('INVALID_INPUT', error.message);
          }
        }
        throw error;
      }
    },
  );

  // workspaces:deleteFolder
  registerHandler(
    WORKSPACE_CHANNELS.DELETE_FOLDER,
    async (event, request: { path: string }) => {
      try {
        await workspaceService.deleteFolder(request.path);
        return { success: true };
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('No active workspace')) {
            throw new IpcError('NOT_FOUND', 'Active workspace not found');
          }
          if (error.message.includes('does not exist')) {
            throw new IpcError('NOT_FOUND', error.message);
          }
          if (error.message.includes('required')) {
            throw new IpcError('INVALID_INPUT', error.message);
          }
        }
        throw error;
      }
    },
  );

  // workspaces:moveFolder
  registerHandler(
    WORKSPACE_CHANNELS.MOVE_FOLDER,
    async (event, request: { sourcePath: string; destinationPath: string | null }) => {
      try {
        return await workspaceService.moveFolder(request.sourcePath, request.destinationPath);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('No active workspace')) {
            throw new IpcError('NOT_FOUND', 'Active workspace not found');
          }
          if (error.message.includes('does not exist')) {
            throw new IpcError('NOT_FOUND', error.message);
          }
          if (error.message.includes('Cannot move') || error.message.includes('required')) {
            throw new IpcError('INVALID_INPUT', error.message);
          }
        }
        throw error;
      }
    },
  );

  // workspaces:delete
  registerHandler(
    WORKSPACE_CHANNELS.DELETE,
    async (event, request: { id: string }) => {
      await workspaceService.deleteWorkspace(request.id);
      return { success: true, id: request.id };
    },
  );

  // workspaces:scan
  registerHandler(
    WORKSPACE_CHANNELS.SCAN,
    async (event, request: { workspaceId: string }) => {
      try {
        return await workspaceService.scanWorkspace(request.workspaceId);
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new IpcError('NOT_FOUND', 'Workspace not found');
        }
        throw error;
      }
    },
  );

  // workspaces:sync
  registerHandler(
    WORKSPACE_CHANNELS.SYNC,
    async (event, request: { workspaceId?: string }) => {
      try {
        const result = await workspaceService.syncWorkspace(request?.workspaceId);
        logger.info(`[IPC] workspaces:sync → ${result.notes.created + result.notes.updated} notes (${result.durationMs}ms)`);
        return result;
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new IpcError('NOT_FOUND', 'Workspace not found');
        }
        throw error;
      }
    },
  );
}
