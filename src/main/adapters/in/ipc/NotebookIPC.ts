/**
 * Notebook IPC Adapter
 *
 * Primary adapter that handles Electron IPC calls for notebook operations.
 */

import { ipcMain } from 'electron';
import { NOTEBOOK_CHANNELS } from '@shared/constants/ipcChannels';
import type { INotebookUseCases } from '../../../application';
import { logger } from '../../../shared';
import { handleIpcRequest } from '@main/shared/utils';

export interface NotebookIPCDeps {
  notebookUseCases: INotebookUseCases;
}

interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export class NotebookIPC {
  constructor(private readonly deps: NotebookIPCDeps) {}

  registerHandlers(): void {
    const { notebookUseCases } = this.deps;

    ipcMain.handle(NOTEBOOK_CHANNELS.CREATE, async (_event, request) => {
      return this.handleRequest(async () => {
        const result = await notebookUseCases.createNotebook.execute(request);
        return result.notebook;
      });
    });

    ipcMain.handle(NOTEBOOK_CHANNELS.UPDATE, async (_event, request) => {
      return this.handleRequest(async () => {
        const result = await notebookUseCases.updateNotebook.execute(request);
        return result.notebook;
      });
    });

    ipcMain.handle(
      NOTEBOOK_CHANNELS.DELETE,
      async (_event, request: { id: string; delete_notes?: boolean }) => {
        return this.handleRequest(async () => {
          // Note: delete_notes is not currently supported by the use case
          await notebookUseCases.deleteNotebook.execute({ id: request.id });
          return undefined;
        });
      },
    );

    ipcMain.handle(NOTEBOOK_CHANNELS.GET_ALL, async (_event, request) => {
      return this.handleRequest(async () => {
        const result = await notebookUseCases.listNotebooks.execute(request || {});
        return { notebooks: result.notebooks };
      });
    });

    ipcMain.handle(
      NOTEBOOK_CHANNELS.MOVE,
      async (_event, request: { id: string; parent_id?: string; position?: number }) => {
        return this.handleRequest(async () => {
          // Note: position is not currently supported by the use case
          await notebookUseCases.moveNotebook.execute({
            id: request.id,
            targetParentId: request.parent_id ?? null,
          });
          return undefined;
        });
      },
    );

    logger.info('[NotebookIPC] Handlers registered');
  }

  unregisterHandlers(): void {
    ipcMain.removeHandler(NOTEBOOK_CHANNELS.CREATE);
    ipcMain.removeHandler(NOTEBOOK_CHANNELS.UPDATE);
    ipcMain.removeHandler(NOTEBOOK_CHANNELS.DELETE);
    ipcMain.removeHandler(NOTEBOOK_CHANNELS.GET_ALL);
    ipcMain.removeHandler(NOTEBOOK_CHANNELS.MOVE);
  }

  private async handleRequest<T>(fn: () => Promise<T>): Promise<IPCResponse<T>> {
    return handleIpcRequest(fn, {
      loggerPrefix: 'NotebookIPC',
      defaultCode: 'INTERNAL_ERROR',
      errorMap: {
        NotebookNotFoundError: 'NOTEBOOK_NOT_FOUND',
        NotebookValidationError: 'VALIDATION_ERROR',
      },
    });
  }
}
