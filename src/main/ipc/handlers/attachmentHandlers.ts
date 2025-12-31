/**
 * Attachment IPC Handlers
 */

import { BrowserWindow } from 'electron';
import { ATTACHMENT_CHANNELS, EVENTS } from '@shared/constants/ipcChannels';
import { getRepositories } from '../../repositories';
import { registerHandler, IpcError } from '../utils';
import path from 'node:path';
import fs from 'node:fs';
import { getDatabaseManager } from '../../database';
import { getMarkdownService } from '../../services/MarkdownService';

/**
 * Register all attachment handlers
 */
export function registerAttachmentHandlers() {
  const repos = getRepositories();

  // attachments:add
  registerHandler(
    ATTACHMENT_CHANNELS.ADD,
    
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
        const relativePath = path.join('attachments', request.noteId, filename).replaceAll('\\', '/');
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
  );

  // attachments:delete
  registerHandler(
    ATTACHMENT_CHANNELS.DELETE,
    async (event, request: { id: string; noteId: string }) => {
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
    }
  );

  // attachments:getAll
  registerHandler(
    ATTACHMENT_CHANNELS.GET_ALL,
    async (event, request: { noteId: string }) => {
      const attachments = await repos.attachment.getAttachmentsForNote(request.noteId);
      return { attachments };
    }
  );

  // attachments:uploadImage - Upload image from paste/drop to workspace .assets folder
  registerHandler(
    ATTACHMENT_CHANNELS.UPLOAD_IMAGE,
    async (
      event,
      request: {
        noteId: string;
        imageData: string; // base64 encoded image data
        mimeType: string;
        filename?: string;
      }
    ) => {
      const note = await repos.note.findById(request.noteId);
      if (!note) {
        throw new IpcError('NOT_FOUND', 'Note not found');
      }

      if (!note.workspaceId) {
        throw new IpcError('INVALID_INPUT', 'Note has no workspace');
      }

      // Get workspace to find folder path
      const workspace = await repos.workspace.findById(note.workspaceId);
      if (!workspace?.folderPath) {
        throw new IpcError('NOT_FOUND', 'Workspace not found');
      }

      // Determine file extension from mime type
      const extMap: Record<string, string> = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/svg+xml': '.svg',
      };
      const ext = extMap[request.mimeType] || '.png';

      // Generate unique filename with timestamp
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
      const random = Math.floor(Math.random() * 10000) // NOSONAR - safe for filename uniqueness
        .toString()
        .padStart(4, '0');
      const filename = request.filename
        ? getMarkdownService().sanitizeFilename(request.filename)
        : `image-${timestamp}-${random}${ext}`;

      // Create .assets folder in workspace root
      const assetsDir = path.join(workspace.folderPath, '.assets');
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      // Resolve and validate destination path
      const destPath = path.resolve(assetsDir, filename);
      const rootAbs = path.resolve(assetsDir);
      const withSep = rootAbs.endsWith(path.sep) ? rootAbs : rootAbs + path.sep;
      if (!destPath.startsWith(withSep) && destPath !== rootAbs) {
        throw new IpcError('INVALID_INPUT', 'Invalid image filename');
      }

      // Decode base64 and write file
      const imageBuffer = Buffer.from(request.imageData, 'base64');
      fs.writeFileSync(destPath, imageBuffer);

      // Return the relative path for use in markdown/HTML
      // Path is relative to workspace root
      const relativePath = `.assets/${filename}`;

      return {
        success: true,
        relativePath,
        absolutePath: destPath,
        filename,
      };
    }
  );
}
