/**
 * Attachment IPC Adapter - Handles file attachment IPC channels
 */

import { ipcMain } from 'electron';
import type { IAttachmentUseCases } from '../../../domain/ports/in/IAttachmentUseCases';
import { logger } from '../../../shared/utils';

const CHANNELS = {
  ADD: 'attachments:add',
  DELETE: 'attachments:delete',
  GET_ALL: 'attachments:getAll',
  UPLOAD_IMAGE: 'attachments:uploadImage',
} as const;

export interface AttachmentIPCDeps {
  attachmentUseCases: IAttachmentUseCases;
}

export function registerAttachmentHandlers(deps: AttachmentIPCDeps): void {
  const { attachmentUseCases } = deps;

  ipcMain.handle(
    CHANNELS.ADD,
    async (_, { noteId, filePath, filename }: { noteId: string; filePath: string; filename?: string }) => {
      try {
        logger.info('[IPC] attachments:add', { noteId, filePath });
        const attachment = await attachmentUseCases.addAttachment(noteId, filePath, filename);
        return {
          success: true,
          data: {
            ...attachment,
            createdAt: attachment.createdAt.toISOString(),
          },
        };
      } catch (error) {
        logger.error('[IPC] attachments:add error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(
    CHANNELS.DELETE,
    async (_, { id, deleteFile }: { id: string; deleteFile?: boolean }) => {
      try {
        logger.info('[IPC] attachments:delete', { attachmentId: id, deleteFile });
        await attachmentUseCases.deleteAttachment(id, deleteFile);
        return { success: true };
      } catch (error) {
        logger.error('[IPC] attachments:delete error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  ipcMain.handle(CHANNELS.GET_ALL, async (_, { noteId }: { noteId: string }) => {
    try {
      const attachments = await attachmentUseCases.getAttachments(noteId);
      return {
        success: true,
        data: {
          attachments: attachments.map((a) => ({
            ...a,
            createdAt: a.createdAt.toISOString(),
          })),
        },
      };
    } catch (error) {
      logger.error('[IPC] attachments:getAll error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle(
    CHANNELS.UPLOAD_IMAGE,
    async (
      _,
      { noteId, imageData, filename, mimeType }: { noteId: string; imageData: string; filename: string; mimeType?: string }
    ) => {
      try {
        logger.info('[IPC] attachments:uploadImage', { noteId, filename });
        const result = await attachmentUseCases.uploadImage(
          noteId,
          imageData,
          filename,
          mimeType
        );
        return {
          success: true,
          data: {
            url: result.markdownLink,
            attachment: {
              ...result.attachment,
              createdAt: result.attachment.createdAt.toISOString(),
            },
          },
        };
      } catch (error) {
        logger.error('[IPC] attachments:uploadImage error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  logger.info('[IPC] Attachment handlers registered');
}

export function unregisterAttachmentHandlers(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
