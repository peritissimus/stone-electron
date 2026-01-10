/**
 * Tag IPC Adapter
 *
 * Primary adapter that handles Electron IPC calls for tag operations.
 */

import { ipcMain } from 'electron';
import { TAG_CHANNELS } from '@shared/constants/ipcChannels';
import type { ITagUseCases } from '../../../application';
import { logger } from '../../../shared';
import { handleIpcRequest } from '@main/shared/utils';

export interface TagIPCDeps {
  tagUseCases: ITagUseCases;
}

interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export class TagIPC {
  constructor(private readonly deps: TagIPCDeps) {}

  registerHandlers(): void {
    const { tagUseCases } = this.deps;

    ipcMain.handle(TAG_CHANNELS.CREATE, async (_event, request) => {
      return handleIpcRequest(
        async () => {
          const result = await tagUseCases.createTag.execute(request);
          return result.tag;
        },
        { loggerPrefix: TAG_CHANNELS.CREATE, errorMap: { TagValidationError: 'VALIDATION_ERROR' } },
      );
    });

    ipcMain.handle(TAG_CHANNELS.DELETE, async (_event, request: { id: string } | string) => {
      return handleIpcRequest(
        async () => {
          const id = typeof request === 'string' ? request : request.id;
          await tagUseCases.deleteTag.execute({ id });
          return { success: true };
        },
        { loggerPrefix: TAG_CHANNELS.DELETE, errorMap: { TagNotFoundError: 'TAG_NOT_FOUND' } },
      );
    });

    ipcMain.handle(TAG_CHANNELS.GET_ALL, async () => {
      return handleIpcRequest(
        async () => {
          const result = await tagUseCases.listTags.execute();
          return { tags: result.tags };
        },
        { loggerPrefix: TAG_CHANNELS.GET_ALL },
      );
    });

    ipcMain.handle(TAG_CHANNELS.ADD_TO_NOTE, async (_event, request: { noteId: string; tagId: string; tagIds?: string[] }) => {
      return handleIpcRequest(
        async () => {
          // Handle both single tagId and array of tagIds
          const tagIds = request.tagIds || [request.tagId];
          for (const tagId of tagIds) {
            await tagUseCases.addTagToNote.execute({ noteId: request.noteId, tagId });
          }
          // Return updated tags list
          const result = await tagUseCases.listTags.execute();
          return { tags: result.tags };
        },
        { loggerPrefix: TAG_CHANNELS.ADD_TO_NOTE, errorMap: { TagNotFoundError: 'TAG_NOT_FOUND' } },
      );
    });

    ipcMain.handle(TAG_CHANNELS.REMOVE_FROM_NOTE, async (_event, request: { noteId: string; tagId: string }) => {
      return handleIpcRequest(
        async () => {
          await tagUseCases.removeTagFromNote.execute({ noteId: request.noteId, tagId: request.tagId });
          return { success: true };
        },
        { loggerPrefix: TAG_CHANNELS.REMOVE_FROM_NOTE, errorMap: { TagNotFoundError: 'TAG_NOT_FOUND' } },
      );
    });

    logger.info('[TagIPC] Handlers registered');
  }

  unregisterHandlers(): void {
    ipcMain.removeHandler(TAG_CHANNELS.CREATE);
    ipcMain.removeHandler(TAG_CHANNELS.DELETE);
    ipcMain.removeHandler(TAG_CHANNELS.GET_ALL);
    ipcMain.removeHandler(TAG_CHANNELS.ADD_TO_NOTE);
    ipcMain.removeHandler(TAG_CHANNELS.REMOVE_FROM_NOTE);
  }
}
