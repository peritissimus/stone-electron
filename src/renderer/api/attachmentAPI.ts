/**
 * Attachment API - IPC channel wrappers for attachment operations
 *
 * Implements: specs/api.ts#AttachmentAPI
 * Pure functions that wrap IPC channels. No React, no stores.
 */

import { z } from 'zod';
import { invokeIpc } from '@renderer/lib/ipc';
import { ATTACHMENT_CHANNELS } from '@shared/constants/ipcChannels';
import type { Attachment, IpcResponse } from '@shared/types';
import { validateResponse } from './validation';
import { AttachmentSchema } from './schemas';

export const attachmentAPI = {
  /**
   * Get all attachments for a note
   */
  getAll: async (noteId: string): Promise<IpcResponse<{ attachments: Attachment[] }>> => {
    const response = await invokeIpc(ATTACHMENT_CHANNELS.GET_ALL, { noteId });
    return validateResponse(response, z.object({ attachments: z.array(AttachmentSchema) }));
  },

  /**
   * Add an attachment to a note
   */
  add: async (noteId: string, filePath: string): Promise<IpcResponse<Attachment>> => {
    const response = await invokeIpc(ATTACHMENT_CHANNELS.ADD, { noteId, filePath });
    return validateResponse(response, AttachmentSchema);
  },

  /**
   * Delete an attachment
   */
  delete: async (id: string): Promise<IpcResponse<void>> => {
    const response = await invokeIpc(ATTACHMENT_CHANNELS.DELETE, { id });
    return validateResponse(response, z.void());
  },

  /**
   * Upload an image and attach to note
   */
  uploadImage: async (
    noteId: string,
    imageData: string,
    filename: string,
  ): Promise<IpcResponse<{ url: string; attachment: Attachment }>> => {
    const response = await invokeIpc(ATTACHMENT_CHANNELS.UPLOAD_IMAGE, {
      noteId,
      imageData,
      filename,
    });
    return validateResponse(
      response,
      z.object({ url: z.string(), attachment: AttachmentSchema }),
    );
  },
};
