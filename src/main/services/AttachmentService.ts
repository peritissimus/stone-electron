/**
 * AttachmentService - Attachment management
 *
 * Handles file attachments, image uploads, and storage management.
 */

import path from 'node:path';
import fs from 'node:fs';
import { getRepositories } from '../repositories';
import { getMarkdownService } from './MarkdownService';
import { getEventBus } from './EventBus';
import { getDatabaseManager } from '../database';
import { EVENTS } from '@shared/constants/ipcChannels';
import { logger } from '../utils/logger';
import type { Attachment } from '@shared/types';

export interface AddAttachmentRequest {
  noteId: string;
  filePath: string;
  filename?: string;
}

export interface UploadImageRequest {
  noteId: string;
  imageData: string; // base64 encoded
  mimeType: string;
  filename?: string;
}

export interface UploadImageResult {
  success: boolean;
  relativePath: string;
  absolutePath: string;
  filename: string;
}

/**
 * MIME type mappings
 */
const MIME_TYPES: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const EXT_FROM_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

/**
 * AttachmentService handles attachment operations
 */
class AttachmentService {
  private readonly markdownService = getMarkdownService();

  // ==========================================================================
  // Attachment CRUD
  // ==========================================================================

  /**
   * Add an attachment from a file path
   */
  async addAttachment(data: AddAttachmentRequest): Promise<Attachment> {
    const repos = getRepositories();

    // Verify note exists
    const note = await repos.note.findById(data.noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    // Verify file exists
    if (!fs.existsSync(data.filePath)) {
      throw new Error('File not found');
    }

    const stats = fs.statSync(data.filePath);
    const rawName = data.filename || path.basename(data.filePath);
    const base = path.basename(rawName);
    const sanitized = this.markdownService.sanitizeFilename(base);
    const filename = sanitized || 'attachment';

    // Determine MIME type
    const ext = path.extname(filename).toLowerCase();
    const mimetype = MIME_TYPES[ext] || 'application/octet-stream';

    // Create attachment directory
    const dbManager = getDatabaseManager();
    const attachmentsDir = path.join(dbManager.getDataPath(), 'attachments', data.noteId);
    if (!fs.existsSync(attachmentsDir)) {
      fs.mkdirSync(attachmentsDir, { recursive: true });
    }

    // Copy file with path traversal protection
    const destPath = this.resolveSecurePath(attachmentsDir, filename);
    fs.copyFileSync(data.filePath, destPath);

    // Create attachment record
    const relativePath = path.join('attachments', data.noteId, filename).replaceAll('\\', '/');
    const attachment = await repos.attachment.create({
      noteId: data.noteId,
      filename,
      path: relativePath,
      mimeType: mimetype,
      size: stats.size,
    });

    getEventBus().emit(EVENTS.ATTACHMENT_ADDED, { attachment });

    logger.info(`[AttachmentService] Added attachment: ${filename} to note ${data.noteId}`);

    return attachment;
  }

  /**
   * Delete an attachment
   */
  async deleteAttachment(id: string): Promise<void> {
    const repos = getRepositories();

    const attachment = await repos.attachment.findById(id);
    if (!attachment) {
      throw new Error('Attachment not found');
    }

    // Delete physical file
    const dbManager = getDatabaseManager();
    const attachmentsRoot = path.join(dbManager.getDataPath(), 'attachments');
    const filePath = path.resolve(dbManager.getDataPath(), attachment.path);

    // Verify path is within attachments directory
    const rootAbs = path.resolve(attachmentsRoot);
    const withSep = rootAbs.endsWith(path.sep) ? rootAbs : rootAbs + path.sep;
    if (filePath.startsWith(withSep) || filePath === rootAbs) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Delete record
    await repos.attachment.delete(id);

    getEventBus().emit(EVENTS.ATTACHMENT_DELETED, { id });

    logger.info(`[AttachmentService] Deleted attachment: ${id}`);
  }

  /**
   * Get all attachments for a note
   */
  async getAttachmentsForNote(noteId: string): Promise<Attachment[]> {
    const repos = getRepositories();
    return repos.attachment.getAttachmentsForNote(noteId);
  }

  // ==========================================================================
  // Image Uploads
  // ==========================================================================

  /**
   * Upload an image from base64 data to workspace .assets folder
   */
  async uploadImage(data: UploadImageRequest): Promise<UploadImageResult> {
    const repos = getRepositories();

    // Verify note exists
    const note = await repos.note.findById(data.noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    if (!note.workspaceId) {
      throw new Error('Note has no workspace');
    }

    // Get workspace folder
    const workspace = await repos.workspace.findById(note.workspaceId);
    if (!workspace?.folderPath) {
      throw new Error('Workspace not found');
    }

    // Generate filename
    const ext = EXT_FROM_MIME[data.mimeType] || '.png';
    const filename = data.filename
      ? this.markdownService.sanitizeFilename(data.filename)
      : this.generateImageFilename(ext);

    // Create .assets folder
    const assetsDir = path.join(workspace.folderPath, '.assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    // Write file with path traversal protection
    const destPath = this.resolveSecurePath(assetsDir, filename);
    const imageBuffer = Buffer.from(data.imageData, 'base64');
    fs.writeFileSync(destPath, imageBuffer);

    const relativePath = `.assets/${filename}`;

    logger.info(`[AttachmentService] Uploaded image: ${filename}`);

    return {
      success: true,
      relativePath,
      absolutePath: destPath,
      filename,
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Resolve a path securely within a root directory
   */
  private resolveSecurePath(rootDir: string, filename: string): string {
    const resolvedDest = path.resolve(rootDir, filename);
    const rootAbs = path.resolve(rootDir);
    const withSep = rootAbs.endsWith(path.sep) ? rootAbs : rootAbs + path.sep;

    if (!resolvedDest.startsWith(withSep) && resolvedDest !== rootAbs) {
      throw new Error('Invalid filename - path traversal detected');
    }

    return resolvedDest;
  }

  /**
   * Generate a unique image filename with timestamp
   */
  private generateImageFilename(ext: string): string {
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      '-',
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('');

    const random = Math.floor(Math.random() * 10000) // NOSONAR - safe for filename uniqueness
      .toString()
      .padStart(4, '0');

    return `image-${timestamp}-${random}${ext}`;
  }
}

// Singleton instance
let instance: AttachmentService | null = null;

export function getAttachmentService(): AttachmentService {
  instance ??= new AttachmentService();
  return instance;
}
