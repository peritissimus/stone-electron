/**
 * Workspace IPC Adapter
 *
 * Primary adapter that handles Electron IPC calls for workspace operations.
 */

import { ipcMain } from 'electron';
import { WORKSPACE_CHANNELS } from '@shared/constants/ipcChannels';
import type { IWorkspaceUseCases } from '../../../application/usecases/WorkspaceUseCases';
import { logger } from '@main/utils/logger';

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

    ipcMain.handle(WORKSPACE_CHANNELS.CREATE, async (_event, request) => {
      return this.handleRequest(async () => {
        const result = await workspaceUseCases.createWorkspace.execute(request);
        return result.workspace;
      });
    });

    ipcMain.handle(WORKSPACE_CHANNELS.GET_ALL, async () => {
      return this.handleRequest(async () => {
        const result = await workspaceUseCases.listWorkspaces.execute();
        return result.workspaces;
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
        const result = await workspaceUseCases.getActiveWorkspace.execute();
        return result.workspace;
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
  }

  private async handleRequest<T>(fn: () => Promise<T>): Promise<IPCResponse<T>> {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const code = this.getErrorCode(error);
      logger.error('[WorkspaceIPC] Error:', { code, message });
      return { success: false, error: { code, message } };
    }
  }

  private getErrorCode(error: unknown): string {
    if (error instanceof Error) {
      switch (error.name) {
        case 'WorkspaceNotFoundError':
          return 'WORKSPACE_NOT_FOUND';
        default:
          return 'INTERNAL_ERROR';
      }
    }
    return 'UNKNOWN_ERROR';
  }
}
