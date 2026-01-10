/**
 * Attachment IPC Adapter - Handles file attachment IPC channels
 */

import { ipcMain } from 'electron';
import { ATTACHMENT_CHANNELS } from '@shared/constants/ipcChannels';
import type { IAttachmentUseCases } from '../../../domain';
import { handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface AttachmentIPCDeps {
  attachmentUseCases: IAttachmentUseCases;
}

export function registerAttachmentHandlers(deps: AttachmentIPCDeps): void {
  const { attachmentUseCases } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, { loggerPrefix: 'AttachmentIPC', defaultCode: 'INTERNAL_ERROR', context });

  ipcMain.handle(
    ATTACHMENT_CHANNELS.ADD,
    async (
      _,
      { noteId, filePath, filename }: { noteId: string; filePath: string; filename?: string },
    ) => {
      return handleRequest(
        async () => {
          const attachment = await attachmentUseCases.addAttachment(noteId, filePath, filename);
          return {
            ...attachment,
            createdAt: attachment.createdAt.toISOString(),
          };
        },
        { channel: ATTACHMENT_CHANNELS.ADD, noteId, filePath, filename },
      );
    },
  );

  ipcMain.handle(
    ATTACHMENT_CHANNELS.DELETE,
    async (_, { id, deleteFile }: { id: string; deleteFile?: boolean }) => {
      return handleRequest(
        async () => {
          await attachmentUseCases.deleteAttachment(id, deleteFile);
          return { success: true };
        },
        { channel: ATTACHMENT_CHANNELS.DELETE, attachmentId: id, deleteFile },
      );
    },
  );

  ipcMain.handle(ATTACHMENT_CHANNELS.GET_ALL, async (_, { noteId }: { noteId: string }) => {
    return handleRequest(
      async () => {
        const attachments = await attachmentUseCases.getAttachments(noteId);
        return {
          attachments: attachments.map((a) => ({
            ...a,
            createdAt: a.createdAt.toISOString(),
          })),
        };
      },
      { channel: ATTACHMENT_CHANNELS.GET_ALL, noteId },
    );
  });

  ipcMain.handle(
    ATTACHMENT_CHANNELS.UPLOAD_IMAGE,
    async (
      _,
      {
        noteId,
        imageData,
        filename,
        mimeType,
      }: { noteId: string; imageData: string; filename: string; mimeType?: string },
    ) => {
      return handleRequest(
        async () => {
          const result = await attachmentUseCases.uploadImage(
            noteId,
            imageData,
            filename,
            mimeType,
          );
          return {
            url: result.markdownLink,
            attachment: {
              ...result.attachment,
              createdAt: result.attachment.createdAt.toISOString(),
            },
          };
        },
        { channel: ATTACHMENT_CHANNELS.UPLOAD_IMAGE, noteId, filename },
      );
    },
  );

  logger.info('[IPC] Attachment handlers registered');
}

export function unregisterAttachmentHandlers(): void {
  Object.values(ATTACHMENT_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
