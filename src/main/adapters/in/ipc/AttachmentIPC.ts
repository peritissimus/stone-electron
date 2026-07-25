/**
 * Attachment IPC Adapter - Handles file attachment IPC channels
 */

import { ipcMain } from 'electron';
import type { Effect } from 'effect';
import { ATTACHMENT_CHANNELS } from '@shared/constants/ipcChannels';
import {
  AddAttachmentRequestSchema,
  DeleteAttachmentRequestSchema,
  GetAttachmentsRequestSchema,
  UploadImageRequestSchema,
} from '@shared/schemas';
import type { IAttachmentUseCases } from '../../../domain';
import { handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface AttachmentIPCDeps {
  runAttachmentEffect: RunAttachmentEffect;
}

export type RunAttachmentEffect = <A, E>(
  use: (service: IAttachmentUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export function registerAttachmentHandlers(deps: AttachmentIPCDeps): void {
  const run = deps.runAttachmentEffect;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, { loggerPrefix: 'AttachmentIPC', defaultCode: 'INTERNAL_ERROR', context });

  ipcMain.handle(
    ATTACHMENT_CHANNELS.ADD,
    async (_, rawRequest) => {
      const { noteId, filePath, filename } = AddAttachmentRequestSchema.parse(rawRequest);
      return handleRequest(
        async () => {
          const attachment = await run((service) =>
            service.addAttachment(noteId, filePath, filename),
          );
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
    async (_, rawRequest) => {
      const { id, deleteFile } = DeleteAttachmentRequestSchema.parse(rawRequest);
      return handleRequest(
        async () => {
          await run((service) =>
            service.deleteAttachment(id, deleteFile),
          );
          return { success: true };
        },
        { channel: ATTACHMENT_CHANNELS.DELETE, attachmentId: id, deleteFile },
      );
    },
  );

  ipcMain.handle(ATTACHMENT_CHANNELS.GET_ALL, async (_, rawRequest) => {
    const { noteId } = GetAttachmentsRequestSchema.parse(rawRequest);
    return handleRequest(
      async () => {
        const attachments = await run((service) =>
          service.getAttachments(noteId),
        );
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
    async (_, rawRequest) => {
      const { noteId, imageData, filename, mimeType } =
        UploadImageRequestSchema.parse(rawRequest);
      return handleRequest(
        async () => {
          const result = await run((service) =>
            service.uploadImage(
              noteId,
              imageData,
              filename,
              mimeType,
            ),
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
