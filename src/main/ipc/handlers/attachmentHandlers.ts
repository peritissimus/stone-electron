/**
 * Attachment IPC Handlers
 */

import { ipcMain, BrowserWindow } from 'electron';
import { ATTACHMENT_CHANNELS, EVENTS } from '@shared/constants/ipcChannels';
import { getRepositories } from '../../repositories';
import { createHandler, IpcError } from '../utils';
import path from 'path';
import fs from 'fs';
import { getDatabaseManager } from '../../database';
import { getMarkdownService } from '../../services/MarkdownService';

/**
 * Register all attachment handlers
 */
export function registerAttachmentHandlers() {
  const repos = getRepositories();

  // attachments:add
  ipcMain.handle(
    ATTACHMENT_CHANNELS.ADD,
    createHandler(
      async (event, request: { noteId: string; file_path: string; filename?: string }) => {
        const note = await repos.note.findById(request.noteId);
        if (!note) {
          throw new IpcError('NOT_FOUND', 'Note not found');
        }

        // Check if file exists
        if (!fs.existsSync(request.file_path)) {
          throw new IpcError('FILE_ERROR', 'File not found');
        }

        // Get file stats
        const stats = fs.statSync(request.file_path);
        const rawName = request.filename || path.basename(request.file_path);
        const base = path.basename(rawName);
        const sanitized = getMarkdownService().sanitizeFilename(base);
        const filename = sanitized || 'attachment';

        // Determine MIME type (basic implementation)
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.txt': 'text/plain',
          '.md': 'text/markdown',
          '.pdf': 'application/pdf',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.doc': 'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        };
        const mimetype = mimeTypes[ext] || 'application/octet-stream';

        // Create attachment directory if it doesn't exist
        const dbManager = getDatabaseManager();
        const attachmentsDir = path.join(dbManager.getDataPath(), 'attachments', request.noteId);
        if (!fs.existsSync(attachmentsDir)) {
          fs.mkdirSync(attachmentsDir, { recursive: true });
        }

        // Copy file to attachments directory with containment check
        const resolvedDest = path.resolve(attachmentsDir, filename);
        const rootAbs = path.resolve(attachmentsDir);
        const withSep = rootAbs.endsWith(path.sep) ? rootAbs : rootAbs + path.sep;
        if (!resolvedDest.startsWith(withSep) && resolvedDest !== rootAbs) {
          throw new IpcError('INVALID_INPUT', 'Invalid attachment filename');
        }
        fs.copyFileSync(request.file_path, resolvedDest);

        // Create attachment record
        const relativePath = path.join('attachments', request.noteId, filename).replace(/\\/g, '/');
        const attachment = await repos.attachment.create({
          noteId: request.noteId,
          filename,
          path: relativePath,
          mimeType: mimetype,
          size: stats.size,
        });

        // Broadcast event
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send(EVENTS.ATTACHMENT_ADDED, { attachment });
        });

        return attachment;
      },
    ),
  );

  // attachments:delete
  ipcMain.handle(
    ATTACHMENT_CHANNELS.DELETE,
    createHandler(async (event, request: { id: string; noteId: string }) => {
      const attachment = await repos.attachment.findById(request.id);
      if (!attachment) {
        throw new IpcError('NOT_FOUND', 'Attachment not found');
      }

      // Delete physical file
      const dbManager = getDatabaseManager();
      const attachmentsRoot = path.join(dbManager.getDataPath(), 'attachments');
      const filePath = path.resolve(dbManager.getDataPath(), attachment.path);
      const rootAbs = path.resolve(attachmentsRoot);
      const withSep = rootAbs.endsWith(path.sep) ? rootAbs : rootAbs + path.sep;
      if (filePath.startsWith(withSep) || filePath === rootAbs) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Delete attachment record
      await repos.attachment.delete(request.id);

      // Broadcast event
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.ATTACHMENT_DELETED, { id: request.id });
      });

      return { success: true };
    }),
  );

  // attachments:getAll
  ipcMain.handle(
    ATTACHMENT_CHANNELS.GET_ALL,
    createHandler(async (event, request: { noteId: string }) => {
      const attachments = await repos.attachment.getAttachmentsForNote(request.noteId);
      return { attachments };
    }),
  );
}
