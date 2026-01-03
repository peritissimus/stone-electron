/**
 * Attachment IPC Handlers
 *
 * Uses services for business logic, not repositories directly.
 * Pattern: IPC Handler → Service → Repository → Database
 */

import { ATTACHMENT_CHANNELS } from '@shared/constants/ipcChannels';
import { getAttachmentService } from '../../services/AttachmentService';
import { registerHandler, IpcError } from '../utils';
import type { Container } from '../../api/container';
import type { AwilixContainer } from 'awilix';

/**
 * Register all attachment handlers
 */
export function registerAttachmentHandlers(_container: AwilixContainer<Container>) {
  // TODO: Add attachmentService to container and use it here
  const attachmentService = getAttachmentService();

  // attachments:add
  registerHandler(
    ATTACHMENT_CHANNELS.ADD,
    async (event, request: { noteId: string; file_path: string; filename?: string }) => {
      try {
        return await attachmentService.addAttachment({
          noteId: request.noteId,
          filePath: request.file_path,
          filename: request.filename,
        });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('Note not found')) {
            throw new IpcError('NOT_FOUND', 'Note not found');
          }
          if (error.message.includes('File not found')) {
            throw new IpcError('FILE_ERROR', 'File not found');
          }
          if (error.message.includes('path traversal')) {
            throw new IpcError('INVALID_INPUT', 'Invalid attachment filename');
          }
        }
        throw error;
      }
    },
  );

  // attachments:delete
  registerHandler(
    ATTACHMENT_CHANNELS.DELETE,
    async (event, request: { id: string; noteId: string }) => {
      try {
        await attachmentService.deleteAttachment(request.id);
        return { success: true };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new IpcError('NOT_FOUND', 'Attachment not found');
        }
        throw error;
      }
    },
  );

  // attachments:getAll
  registerHandler(
    ATTACHMENT_CHANNELS.GET_ALL,
    async (event, request: { noteId: string }) => {
      const attachments = await attachmentService.getAttachmentsForNote(request.noteId);
      return { attachments };
    },
  );

  // attachments:uploadImage
  registerHandler(
    ATTACHMENT_CHANNELS.UPLOAD_IMAGE,
    async (
      event,
      request: {
        noteId: string;
        imageData: string;
        mimeType: string;
        filename?: string;
      },
    ) => {
      try {
        return await attachmentService.uploadImage({
          noteId: request.noteId,
          imageData: request.imageData,
          mimeType: request.mimeType,
          filename: request.filename,
        });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('Note not found')) {
            throw new IpcError('NOT_FOUND', 'Note not found');
          }
          if (error.message.includes('no workspace')) {
            throw new IpcError('INVALID_INPUT', 'Note has no workspace');
          }
          if (error.message.includes('Workspace not found')) {
            throw new IpcError('NOT_FOUND', 'Workspace not found');
          }
          if (error.message.includes('path traversal')) {
            throw new IpcError('INVALID_INPUT', 'Invalid image filename');
          }
        }
        throw error;
      }
    },
  );
}
