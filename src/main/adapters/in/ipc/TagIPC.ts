/**
 * Tag IPC Adapter
 *
 * Every handler parses its request payload via a shared Zod schema at
 * the boundary and binds its return type to the response schema the
 * renderer expects — so wire-shape drift between the main process use
 * cases and the renderer is a compile-time error.
 */

import { ipcMain } from 'electron';
import { TAG_CHANNELS } from '@shared/constants/ipcChannels';
import {
  AddTagToNoteRequestSchema,
  CreateTagRequestSchema,
  DeleteTagRequestSchema,
  ListTagsRequestSchema,
  RemoveTagFromNoteRequestSchema,
  type ListTagsResponse,
  type TagResponse,
} from '@shared/schemas';
import type { ITagUseCases } from '../../../domain';
import { logger } from '../../../shared';
import { COMMON_IPC_ERROR_MAP, handleIpcRequest } from '@main/shared/utils';

export interface TagIPCDeps {
  tagUseCases: ITagUseCases;
}

export class TagIPC {
  constructor(private readonly deps: TagIPCDeps) {}

  registerHandlers(): void {
    const { tagUseCases } = this.deps;
    const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
      handleIpcRequest<T>(fn, {
        loggerPrefix: 'TagIPC',
        defaultCode: 'INTERNAL_ERROR',
        errorMap: {
          ...COMMON_IPC_ERROR_MAP,
          TagValidationError: 'VALIDATION_ERROR',
          TagNotFoundError: 'TAG_NOT_FOUND',
        },
        context,
      });

    ipcMain.handle(TAG_CHANNELS.CREATE, async (_event, rawRequest) => {
      const request = CreateTagRequestSchema.parse(rawRequest);
      return handleRequest<TagResponse>(
        async () => {
          const result = await tagUseCases.createTag.execute(request);
          return result.tag;
        },
        { channel: TAG_CHANNELS.CREATE, name: request.name },
      );
    });

    ipcMain.handle(TAG_CHANNELS.DELETE, async (_event, rawRequest) => {
      const { id } = DeleteTagRequestSchema.parse(rawRequest);
      return handleRequest<void>(
        async () => {
          await tagUseCases.deleteTag.execute({ id });
        },
        { channel: TAG_CHANNELS.DELETE, tagId: id },
      );
    });

    ipcMain.handle(TAG_CHANNELS.GET_ALL, async (_event, rawRequest) => {
      // listTags takes no behavior-affecting params on the backend today;
      // parse the renderer's optional sort hint for shape, then discard.
      ListTagsRequestSchema.parse(rawRequest ?? {});
      return handleRequest<ListTagsResponse>(
        async () => {
          const result = await tagUseCases.listTags.execute();
          return { tags: result.tags as ListTagsResponse['tags'] };
        },
        { channel: TAG_CHANNELS.GET_ALL },
      );
    });

    ipcMain.handle(TAG_CHANNELS.ADD_TO_NOTE, async (_event, rawRequest) => {
      const request = AddTagToNoteRequestSchema.parse(rawRequest);
      const tagIds =
        request.tagIds && request.tagIds.length > 0
          ? request.tagIds
          : [request.tagId as string];
      return handleRequest<ListTagsResponse>(
        async () => {
          for (const tagId of tagIds) {
            await tagUseCases.addTagToNote.execute({ noteId: request.noteId, tagId });
          }
          const result = await tagUseCases.listTags.execute();
          return { tags: result.tags as ListTagsResponse['tags'] };
        },
        { channel: TAG_CHANNELS.ADD_TO_NOTE, noteId: request.noteId, tagIds },
      );
    });

    ipcMain.handle(TAG_CHANNELS.REMOVE_FROM_NOTE, async (_event, rawRequest) => {
      const { noteId, tagId } = RemoveTagFromNoteRequestSchema.parse(rawRequest);
      return handleRequest<void>(
        async () => {
          await tagUseCases.removeTagFromNote.execute({ noteId, tagId });
        },
        { channel: TAG_CHANNELS.REMOVE_FROM_NOTE, noteId, tagId },
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
