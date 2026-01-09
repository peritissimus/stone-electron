/**
 * Tag IPC Adapter
 *
 * Primary adapter that handles Electron IPC calls for tag operations.
 */

import { ipcMain } from 'electron';
import { TAG_CHANNELS } from '@shared/constants/ipcChannels';
import type { ITagUseCases } from '../../../application';
import { logger } from '../../../shared';

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
      return this.handleRequest(async () => {
        const result = await tagUseCases.createTag.execute(request);
        return result.tag;
      });
    });

    ipcMain.handle(TAG_CHANNELS.DELETE, async (_event, request: { id: string } | string) => {
      return this.handleRequest(async () => {
        const id = typeof request === 'string' ? request : request.id;
        await tagUseCases.deleteTag.execute({ id });
        return { success: true };
      });
    });

    ipcMain.handle(TAG_CHANNELS.GET_ALL, async () => {
      return this.handleRequest(async () => {
        const result = await tagUseCases.listTags.execute();
        return { tags: result.tags };
      });
    });

    ipcMain.handle(TAG_CHANNELS.ADD_TO_NOTE, async (_event, request: { noteId: string; tagId: string; tagIds?: string[] }) => {
      return this.handleRequest(async () => {
        // Handle both single tagId and array of tagIds
        const tagIds = request.tagIds || [request.tagId];
        for (const tagId of tagIds) {
          await tagUseCases.addTagToNote.execute({ noteId: request.noteId, tagId });
        }
        // Return updated tags list
        const result = await tagUseCases.listTags.execute();
        return { tags: result.tags };
      });
    });

    ipcMain.handle(TAG_CHANNELS.REMOVE_FROM_NOTE, async (_event, request: { noteId: string; tagId: string }) => {
      return this.handleRequest(async () => {
        await tagUseCases.removeTagFromNote.execute({ noteId: request.noteId, tagId: request.tagId });
        return { success: true };
      });
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

  private async handleRequest<T>(fn: () => Promise<T>): Promise<IPCResponse<T>> {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const code = this.getErrorCode(error);
      logger.error('[TagIPC] Error:', { code, message });
      return { success: false, error: { code, message } };
    }
  }

  private getErrorCode(error: unknown): string {
    if (error instanceof Error) {
      switch (error.name) {
        case 'TagNotFoundError':
          return 'TAG_NOT_FOUND';
        default:
          return 'INTERNAL_ERROR';
      }
    }
    return 'UNKNOWN_ERROR';
  }
}
