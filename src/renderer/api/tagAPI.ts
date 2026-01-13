/**
 * Tag API - IPC channel wrappers for tag operations
 *
 * Implements: specs/api.ts#TagAPI
 * Pure functions that wrap IPC channels. No React, no stores.
 */

import { z } from 'zod';
import { invokeIpc } from '@renderer/lib/ipc';
import { TAG_CHANNELS } from '@shared/constants/ipcChannels';
import type { Tag, TagWithCount, IpcResponse } from '@shared/types';
import { validateResponse } from './validation';
import { TagSchema, TagWithCountSchema } from './schemas';

export interface GetAllTagsParams {
  sort?: 'name' | 'count' | 'recent';
}

export const tagAPI = {
  /**
   * Get all tags
   */
  getAll: async (params?: GetAllTagsParams): Promise<IpcResponse<{ tags: TagWithCount[] }>> => {
    const response = await invokeIpc(TAG_CHANNELS.GET_ALL, params);
    return validateResponse(response, z.object({ tags: z.array(TagWithCountSchema) }));
  },

  /**
   * Create a new tag
   */
  create: async (data: { name: string; color?: string }): Promise<IpcResponse<Tag>> => {
    const response = await invokeIpc(TAG_CHANNELS.CREATE, data);
    return validateResponse(response, TagSchema);
  },

  /**
   * Delete a tag
   */
  delete: async (id: string): Promise<IpcResponse<void>> => {
    const response = await invokeIpc(TAG_CHANNELS.DELETE, { id });
    return validateResponse(response, z.void());
  },

  /**
   * Add tags to a note
   */
  addToNote: async (
    noteId: string,
    tagIds: string[],
  ): Promise<IpcResponse<{ tags: TagWithCount[] }>> => {
    const response = await invokeIpc(TAG_CHANNELS.ADD_TO_NOTE, { noteId, tagIds });
    return validateResponse(response, z.object({ tags: z.array(TagWithCountSchema) }));
  },

  /**
   * Remove a tag from a note
   */
  removeFromNote: async (noteId: string, tagId: string): Promise<IpcResponse<void>> => {
    const response = await invokeIpc(TAG_CHANNELS.REMOVE_FROM_NOTE, { noteId, tagId });
    return validateResponse(response, z.void());
  },
};
