/**
 * Workspace IPC Adapter
 *
 * Primary adapter that handles Electron IPC calls for workspace operations.
 */

import { ipcMain } from 'electron';
import { WORKSPACE_CHANNELS } from '@shared/constants/ipcChannels';
import type { IWorkspaceUseCases } from '../../../application';
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
        return this.handleRequest(async () => {
          // Handle both 'path' (from renderer) and 'folderPath' (from use case)
          const folderPath = request.folderPath || request.path;
          if (!folderPath) {
            throw new Error('Folder path is required');
          }
          const result = await workspaceUseCases.createWorkspace.execute({
            name: request.name,
            folderPath,
          });
          return result.workspace;
        });
      },
    );

    ipcMain.handle(WORKSPACE_CHANNELS.GET_ALL, async () => {
      return this.handleRequest(async () => {
        logger.info('[IPC] workspaces:getAll CALLED');
        const result = await workspaceUseCases.listWorkspaces.execute();
        logger.info('[IPC] workspaces:getAll result:', result.workspaces.length, 'workspaces');
        if (result.workspaces.length > 0) {
          logger.info(
            '[IPC] workspaces:getAll first workspace:',
            JSON.stringify(result.workspaces[0]),
          );
        }
        return { workspaces: result.workspaces };
      });
    });

    ipcMain.handle(WORKSPACE_CHANNELS.DELETE, async (_event, id: string) => {
      return this.handleRequest(async () => {
        await workspaceUseCases.deleteWorkspace.execute({ id });
        return { success: true };
      });
    });

    ipcMain.handle(WORKSPACE_CHANNELS.SET_ACTIVE, async (_event, id: string) => {
      return this.handleRequest(async () => {
        const result = await workspaceUseCases.setActiveWorkspace.execute({ id });
        return result.workspace;
      });
    });

    ipcMain.handle(WORKSPACE_CHANNELS.GET_ACTIVE, async () => {
      return this.handleRequest(async () => {
        logger.info('[IPC] workspaces:getActive CALLED');
        const result = await workspaceUseCases.getActiveWorkspace.execute();
        logger.info('[IPC] workspaces:getActive result:', result.workspace?.id || 'null');
        return { workspace: result.workspace };
      });
    });

    // UPDATE - Update workspace name
    ipcMain.handle(
      WORKSPACE_CHANNELS.UPDATE,
      async (_event, request: { id: string; name?: string }) => {
        return this.handleRequest(async () => {
          const result = await workspaceUseCases.updateWorkspace.execute(request);
          return result.workspace;
        });
      },
    );

    // SELECT_FOLDER - Show folder selection dialog
    ipcMain.handle(WORKSPACE_CHANNELS.SELECT_FOLDER, async () => {
      return this.handleRequest(async () => {
        const result = await workspaceUseCases.selectFolder.execute();
        return result;
      });
    });

    // VALIDATE_PATH - Validate a folder path exists
    ipcMain.handle(
      WORKSPACE_CHANNELS.VALIDATE_PATH,
      async (_event, request: { folderPath: string }) => {
        return this.handleRequest(async () => {
          const result = await workspaceUseCases.validatePath.execute(request);
          return result;
        });
      },
    );

    // CREATE_FOLDER - Create a new folder in workspace
    ipcMain.handle(
      WORKSPACE_CHANNELS.CREATE_FOLDER,
      async (_event, request: { name: string; parentPath?: string }) => {
        return this.handleRequest(async () => {
          const result = await workspaceUseCases.createFolder.execute(request);
          return result;
        });
      },
    );

    // RENAME_FOLDER - Rename a folder
    ipcMain.handle(
      WORKSPACE_CHANNELS.RENAME_FOLDER,
      async (_event, request: { path: string; name: string }) => {
        return this.handleRequest(async () => {
          const result = await workspaceUseCases.renameFolder.execute(request);
          return result;
        });
      },
    );

    // DELETE_FOLDER - Delete a folder
    ipcMain.handle(WORKSPACE_CHANNELS.DELETE_FOLDER, async (_event, request: { path: string }) => {
      return this.handleRequest(async () => {
        await workspaceUseCases.deleteFolder.execute(request);
        return { success: true };
      });
    });

    // MOVE_FOLDER - Move a folder
    ipcMain.handle(
      WORKSPACE_CHANNELS.MOVE_FOLDER,
      async (_event, request: { sourcePath: string; destinationPath: string | null }) => {
        return this.handleRequest(async () => {
          const result = await workspaceUseCases.moveFolder.execute(request);
          return result;
        });
      },
    );

    // SCAN - Scan workspace for markdown files
    ipcMain.handle(WORKSPACE_CHANNELS.SCAN, async (_event, request: { workspaceId: string }) => {
      return this.handleRequest(async () => {
        const result = await workspaceUseCases.scanWorkspace.execute(request);
        return result;
      });
    });

    // SYNC - Sync workspace with filesystem
    ipcMain.handle(WORKSPACE_CHANNELS.SYNC, async (_event, request?: { workspaceId?: string }) => {
      return this.handleRequest(async () => {
        const result = await workspaceUseCases.syncWorkspace.execute(request);
        logger.info(
          `[WorkspaceIPC] Sync completed: ${result.notes.created + result.notes.updated} notes (${result.durationMs}ms)`,
        );
        return result;
      });
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

  private async handleRequest<T>(fn: () => Promise<T>): Promise<IPCResponse<T>> {
    return handleIpcRequest(fn, {
      loggerPrefix: 'WorkspaceIPC',
      defaultCode: 'INTERNAL_ERROR',
      errorMap: {
        WorkspaceNotFoundError: 'WORKSPACE_NOT_FOUND',
      },
    });
  }
}
