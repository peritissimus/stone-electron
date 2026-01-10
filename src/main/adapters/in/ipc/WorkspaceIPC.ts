/**
 * Workspace IPC Adapter
 *
 * Primary adapter that handles Electron IPC calls for workspace operations.
 */

import { ipcMain } from 'electron';
import { WORKSPACE_CHANNELS } from '@shared/constants/ipcChannels';
import type { IWorkspaceUseCases } from '../../../domain';
import { logger } from '../../../shared';
import { handleIpcRequest } from '@main/shared/utils';

export interface WorkspaceIPCDeps {
  workspaceUseCases: IWorkspaceUseCases;
}

interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export class WorkspaceIPC {
  constructor(private readonly deps: WorkspaceIPCDeps) {}

  registerHandlers(): void {
    const { workspaceUseCases } = this.deps;

    ipcMain.handle(
      WORKSPACE_CHANNELS.CREATE,
      async (_event, request: { name: string; path?: string; folderPath?: string }) => {
        return this.handleRequest(
          async () => {
            const folderPath = request.folderPath || request.path;
            if (!folderPath) {
              throw new Error('Folder path is required');
            }
            const result = await workspaceUseCases.createWorkspace.execute({
              name: request.name,
              folderPath,
            });
            return result.workspace;
          },
          { channel: WORKSPACE_CHANNELS.CREATE, workspaceName: request.name, folderPath: request.folderPath ?? request.path },
        );
      },
    );

    ipcMain.handle(WORKSPACE_CHANNELS.GET_ALL, async () => {
      return this.handleRequest(
        async () => {
          const result = await workspaceUseCases.listWorkspaces.execute();
          return { workspaces: result.workspaces };
        },
        { channel: WORKSPACE_CHANNELS.GET_ALL },
      );
    });

    ipcMain.handle(WORKSPACE_CHANNELS.DELETE, async (_event, request: { id: string } | string) => {
      return this.handleRequest(
        async () => {
          const id = typeof request === 'string' ? request : request.id;
          await workspaceUseCases.deleteWorkspace.execute({ id });
          return { success: true };
        },
        {
          channel: WORKSPACE_CHANNELS.DELETE,
          workspaceId: typeof request === 'string' ? request : request.id,
        },
      );
    });

    ipcMain.handle(
      WORKSPACE_CHANNELS.SET_ACTIVE,
      async (_event, request: { id: string } | string) => {
        return this.handleRequest(
          async () => {
            const id = typeof request === 'string' ? request : request.id;
            const result = await workspaceUseCases.setActiveWorkspace.execute({ id });
            return result.workspace;
          },
          {
            channel: WORKSPACE_CHANNELS.SET_ACTIVE,
            workspaceId: typeof request === 'string' ? request : request.id,
          },
        );
      },
    );

    ipcMain.handle(WORKSPACE_CHANNELS.GET_ACTIVE, async () => {
      return this.handleRequest(
        async () => {
          const result = await workspaceUseCases.getActiveWorkspace.execute();
          return { workspace: result.workspace };
        },
        { channel: WORKSPACE_CHANNELS.GET_ACTIVE },
      );
    });

    // UPDATE - Update workspace name
    ipcMain.handle(
      WORKSPACE_CHANNELS.UPDATE,
      async (_event, request: { id: string; name?: string }) => {
        return this.handleRequest(
          async () => {
            const result = await workspaceUseCases.updateWorkspace.execute(request);
            return result.workspace;
          },
          { channel: WORKSPACE_CHANNELS.UPDATE, workspaceId: request.id },
        );
      },
    );

    // SELECT_FOLDER - Show folder selection dialog
    ipcMain.handle(WORKSPACE_CHANNELS.SELECT_FOLDER, async () => {
      return this.handleRequest(
        async () => {
          const result = await workspaceUseCases.selectFolder.execute();
          return result;
        },
        { channel: WORKSPACE_CHANNELS.SELECT_FOLDER },
      );
    });

    // VALIDATE_PATH - Validate a folder path exists
    ipcMain.handle(
      WORKSPACE_CHANNELS.VALIDATE_PATH,
      async (_event, request: { path: string } | { folderPath: string }) => {
        return this.handleRequest(
          async () => {
            const folderPath =
              'folderPath' in request && typeof request.folderPath === 'string'
                ? request.folderPath
                : (request as { path: string }).path;

            const result = await workspaceUseCases.validatePath.execute({ folderPath });
            return { valid: result.valid, message: result.error };
          },
          {
            channel: WORKSPACE_CHANNELS.VALIDATE_PATH,
            folderPath:
              'folderPath' in request && typeof request.folderPath === 'string'
                ? request.folderPath
                : (request as { path: string }).path,
          },
        );
      },
    );

    // CREATE_FOLDER - Create a new folder in workspace
    ipcMain.handle(
      WORKSPACE_CHANNELS.CREATE_FOLDER,
      async (_event, request: { name: string; parentPath?: string }) => {
        return this.handleRequest(
          async () => {
            const result = await workspaceUseCases.createFolder.execute(request);
            return { folderPath: result.path };
          },
          { channel: WORKSPACE_CHANNELS.CREATE_FOLDER, parentPath: request.parentPath },
        );
      },
    );

    // RENAME_FOLDER - Rename a folder
    ipcMain.handle(
      WORKSPACE_CHANNELS.RENAME_FOLDER,
      async (_event, request: { path: string; name: string }) => {
        return this.handleRequest(
          async () => {
            const result = await workspaceUseCases.renameFolder.execute(request);
            return { folderPath: result.newPath };
          },
          { channel: WORKSPACE_CHANNELS.RENAME_FOLDER, path: request.path },
        );
      },
    );

    // DELETE_FOLDER - Delete a folder
    ipcMain.handle(WORKSPACE_CHANNELS.DELETE_FOLDER, async (_event, request: { path: string }) => {
      return this.handleRequest(
        async () => {
          await workspaceUseCases.deleteFolder.execute(request);
          return { success: true };
        },
        { channel: WORKSPACE_CHANNELS.DELETE_FOLDER, path: request.path },
      );
    });

    // MOVE_FOLDER - Move a folder
    ipcMain.handle(
      WORKSPACE_CHANNELS.MOVE_FOLDER,
      async (_event, request: { sourcePath: string; destinationPath: string | null }) => {
        return this.handleRequest(
          async () => {
            const result = await workspaceUseCases.moveFolder.execute(request);
            return { folderPath: result.newPath };
          },
          {
            channel: WORKSPACE_CHANNELS.MOVE_FOLDER,
            sourcePath: request.sourcePath,
            destinationPath: request.destinationPath,
          },
        );
      },
    );

    // SCAN - Scan workspace for markdown files
    ipcMain.handle(WORKSPACE_CHANNELS.SCAN, async (_event, request: { workspaceId: string }) => {
      return this.handleRequest(
        async () => {
          const result = await workspaceUseCases.scanWorkspace.execute(request);
          return result;
        },
        { channel: WORKSPACE_CHANNELS.SCAN, workspaceId: request.workspaceId },
      );
    });

    // SYNC - Sync workspace with filesystem
    ipcMain.handle(WORKSPACE_CHANNELS.SYNC, async (_event, request?: { workspaceId?: string }) => {
      return this.handleRequest(
        async () => {
          const result = await workspaceUseCases.syncWorkspace.execute(request);
          return result;
        },
        { channel: WORKSPACE_CHANNELS.SYNC, workspaceId: request?.workspaceId },
      );
    });

    logger.info('[WorkspaceIPC] Handlers registered');
  }

  unregisterHandlers(): void {
    ipcMain.removeHandler(WORKSPACE_CHANNELS.CREATE);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.GET_ALL);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.DELETE);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.SET_ACTIVE);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.GET_ACTIVE);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.UPDATE);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.SELECT_FOLDER);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.VALIDATE_PATH);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.CREATE_FOLDER);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.RENAME_FOLDER);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.DELETE_FOLDER);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.MOVE_FOLDER);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.SCAN);
    ipcMain.removeHandler(WORKSPACE_CHANNELS.SYNC);
  }

  private async handleRequest<T>(
    fn: () => Promise<T>,
    context?: Record<string, unknown>,
  ): Promise<IPCResponse<T>> {
    return handleIpcRequest(fn, {
      loggerPrefix: 'WorkspaceIPC',
      defaultCode: 'INTERNAL_ERROR',
      errorMap: {
        WorkspaceNotFoundError: 'WORKSPACE_NOT_FOUND',
      },
      context,
    });
  }
}
