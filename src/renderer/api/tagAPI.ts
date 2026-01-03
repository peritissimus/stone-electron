/**
 * Tag API - IPC channel wrappers for tag operations
 *
 * Implements: specs/api.ts#TagAPI
 * Pure functions that wrap IPC channels. No React, no stores.
 */

import { invokeIpc } from '@renderer/lib/ipc';
import { TAG_CHANNELS } from '@shared/constants/ipcChannels';
import type { Tag, TagWithCount, IpcResponse } from '@shared/types';

export interface GetAllTagsParams {
  sort?: 'name' | 'count' | 'recent';
}

export const tagAPI = {
  /**
   * Get all tags
   */
  getAll: (params?: GetAllTagsParams): Promise<IpcResponse<{ tags: TagWithCount[] }>> =>
    invokeIpc(TAG_CHANNELS.GET_ALL, params),

  /**
   * Create a new tag
   */
  create: (data: {
    name: string;
    color?: string;
  }): Promise<IpcResponse<Tag>> =>
    invokeIpc(TAG_CHANNELS.CREATE, data),

  /**
   * Delete a tag
   */
  delete: (id: string): Promise<IpcResponse<void>> =>
    invokeIpc(TAG_CHANNELS.DELETE, { id }),

  /**
   * Add tags to a note
   */
  addToNote: (
    noteId: string,
    tagIds: string[]
  ): Promise<IpcResponse<{ tags: TagWithCount[] }>> =>
    invokeIpc(TAG_CHANNELS.ADD_TO_NOTE, { noteId, tagIds }),

  /**
   * Remove a tag from a note
   */
  removeFromNote: (noteId: string, tagId: string): Promise<IpcResponse<void>> =>
    invokeIpc(TAG_CHANNELS.REMOVE_FROM_NOTE, { noteId, tagId }),
};
