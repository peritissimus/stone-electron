/**
 * Notebook IPC Adapter
 *
 * Every handler parses its request payload via a shared Zod schema at
 * the boundary and binds its return type to the response schema the
 * renderer expects — so wire-shape drift between the main process use
 * cases and the renderer is a compile-time error.
 */

import { ipcMain } from 'electron';
import { NOTEBOOK_CHANNELS } from '@shared/constants/ipcChannels';
import {
  CreateNotebookRequestSchema,
  DeleteNotebookRequestSchema,
  ListNotebooksRequestSchema,
  MoveNotebookRequestSchema,
  UpdateNotebookRequestSchema,
  type ListNotebooksResponse,
  type NotebookResponse,
} from '@shared/schemas';
import type { INotebookUseCases } from '../../../domain';
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

    ipcMain.handle(NOTEBOOK_CHANNELS.CREATE, async (_event, rawRequest) => {
      const request = CreateNotebookRequestSchema.parse(rawRequest);
      return this.handleRequest<NotebookResponse>(
        async () => {
          const result = await notebookUseCases.createNotebook.execute({
            name: request.name,
            parentId: request.parent_id,
            icon: request.icon,
            color: request.color,
          });
          return result.notebook;
        },
        {
          channel: NOTEBOOK_CHANNELS.CREATE,
          name: request.name,
          parentId: request.parent_id,
        },
      );
    });

    ipcMain.handle(NOTEBOOK_CHANNELS.UPDATE, async (_event, rawRequest) => {
      const request = UpdateNotebookRequestSchema.parse(rawRequest);
      return this.handleRequest<NotebookResponse>(
        async () => {
          const result = await notebookUseCases.updateNotebook.execute(request);
          return result.notebook;
        },
        { channel: NOTEBOOK_CHANNELS.UPDATE, notebookId: request.id },
      );
    });

    ipcMain.handle(NOTEBOOK_CHANNELS.DELETE, async (_event, rawRequest) => {
      const { id, delete_notes } = DeleteNotebookRequestSchema.parse(rawRequest);
      return this.handleRequest<void>(
        async () => {
          await notebookUseCases.deleteNotebook.execute({
            id,
            deleteNotes: delete_notes,
          });
        },
        {
          channel: NOTEBOOK_CHANNELS.DELETE,
          notebookId: id,
          deleteNotes: delete_notes,
        },
      );
    });

    ipcMain.handle(NOTEBOOK_CHANNELS.GET_ALL, async (_event, rawRequest) => {
      const request = ListNotebooksRequestSchema.parse(rawRequest ?? {});
      return this.handleRequest<ListNotebooksResponse>(
        async () => {
          const result = await notebookUseCases.listNotebooks.execute({
            includeNoteCount: request.include_counts ?? false,
          });
          return { notebooks: result.notebooks };
        },
        { channel: NOTEBOOK_CHANNELS.GET_ALL },
      );
    });

    ipcMain.handle(NOTEBOOK_CHANNELS.MOVE, async (_event, rawRequest) => {
      const { id, parent_id } = MoveNotebookRequestSchema.parse(rawRequest);
      return this.handleRequest<void>(
        async () => {
          // Note: position is not currently supported by the use case
          await notebookUseCases.moveNotebook.execute({
            id,
            targetParentId: parent_id ?? null,
          });
        },
        {
          channel: NOTEBOOK_CHANNELS.MOVE,
          notebookId: id,
          targetParentId: parent_id ?? null,
        },
      );
    });

    logger.info('[NotebookIPC] Handlers registered');
  }

  unregisterHandlers(): void {
    ipcMain.removeHandler(NOTEBOOK_CHANNELS.CREATE);
    ipcMain.removeHandler(NOTEBOOK_CHANNELS.UPDATE);
    ipcMain.removeHandler(NOTEBOOK_CHANNELS.DELETE);
    ipcMain.removeHandler(NOTEBOOK_CHANNELS.GET_ALL);
    ipcMain.removeHandler(NOTEBOOK_CHANNELS.MOVE);
  }

  private async handleRequest<T>(
    fn: () => Promise<T>,
    context?: Record<string, unknown>,
  ): Promise<IPCResponse<T>> {
    return handleIpcRequest(fn, {
      loggerPrefix: 'NotebookIPC',
      defaultCode: 'INTERNAL_ERROR',
      errorMap: {
        NotebookNotFoundError: 'NOTEBOOK_NOT_FOUND',
        NotebookValidationError: 'VALIDATION_ERROR',
        ZodError: 'VALIDATION_ERROR',
      },
      context,
    });
  }
}
