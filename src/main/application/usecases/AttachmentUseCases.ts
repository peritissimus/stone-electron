/**
 * Attachment Use Cases - File attachment management
 */

import type { INoteRepository } from '../../domain/ports/out/INoteRepository';
import type { IAttachmentRepository } from '../../domain/ports/out/IAttachmentRepository';
import type { IWorkspaceRepository } from '../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../domain/ports/out/IFileStorage';
import type { IAttachmentUseCases } from '../../domain/ports/in/IAttachmentUseCases';
import { AttachmentEntity } from '../../domain/entities/Attachment';
import { logger } from '../../shared/utils';
import path from 'node:path';
import crypto from 'node:crypto';

export interface AttachmentUseCasesDeps {
  noteRepository: INoteRepository;
  attachmentRepository: IAttachmentRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
}

function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
  };
  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
}

function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

function isPdfMime(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

class AttachmentUseCasesImpl implements IAttachmentUseCases {
  constructor(private deps: AttachmentUseCasesDeps) {}

  async addAttachment(noteId: string, filePath: string, filename?: string) {
    const { noteRepository, attachmentRepository, workspaceRepository, fileStorage } = this.deps;

    const note = await noteRepository.findById(noteId);
    if (!note || !note.workspaceId) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const workspace = await workspaceRepository.findById(note.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${note.workspaceId}`);
    }

    const originalName = filename || path.basename(filePath);
    const ext = path.extname(originalName);
    const uniqueFilename = `${crypto.randomUUID()}${ext}`;
    const mimeType = getMimeType(ext);

    // Create attachments directory
    const attachmentsDir = path.join(workspace.folderPath, '.attachments', noteId);
    await fileStorage.createDirectory(attachmentsDir);

    // Copy file to attachments directory
    const destPath = path.join(attachmentsDir, uniqueFilename);
    await fileStorage.copy(filePath, destPath);

    // Get file info
    const fileInfo = await fileStorage.getFileInfo(destPath);

    // Create attachment entity
    const attachment = AttachmentEntity.create({
      id: crypto.randomUUID(),
      noteId,
      filename: uniqueFilename,
      mimeType,
      size: fileInfo?.size || 0,
      path: path.relative(workspace.folderPath, destPath),
    });

    await attachmentRepository.save(attachment);

    logger.info(`[AttachmentUseCases] Added attachment ${attachment.id} to note ${noteId}`);

    return {
      id: attachment.id,
      noteId: attachment.noteId,
      filename: attachment.filename,
      originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      path: attachment.path,
      isImage: isImageMime(attachment.mimeType),
      isPdf: isPdfMime(attachment.mimeType),
      createdAt: attachment.createdAt,
    };
  }

  async deleteAttachment(attachmentId: string, deleteFile: boolean = true): Promise<void> {
    const { attachmentRepository, workspaceRepository, noteRepository, fileStorage } = this.deps;

    const attachment = await attachmentRepository.findById(attachmentId);
    if (!attachment) {
      throw new Error(`Attachment not found: ${attachmentId}`);
    }

    if (deleteFile) {
      const note = await noteRepository.findById(attachment.noteId);
      if (note?.workspaceId) {
        const workspace = await workspaceRepository.findById(note.workspaceId);
        if (workspace) {
          const absolutePath = path.join(workspace.folderPath, attachment.path);
          await fileStorage.delete(absolutePath);
        }
      }
    }

    await attachmentRepository.delete(attachmentId);
    logger.info(`[AttachmentUseCases] Deleted attachment ${attachmentId}`);
  }

  async getAttachments(noteId: string) {
    const attachments = await this.deps.attachmentRepository.findByNoteId(noteId);

    return attachments.map((a) => ({
      id: a.id,
      noteId: a.noteId,
      filename: a.filename,
      originalName: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      path: a.path,
      isImage: isImageMime(a.mimeType),
      isPdf: isPdfMime(a.mimeType),
      createdAt: a.createdAt,
    }));
  }

  async uploadImage(
    noteId: string,
    imageData: Buffer | string,
    filename: string,
    mimeType?: string,
  ) {
    const { noteRepository, workspaceRepository, fileStorage } = this.deps;

    const note = await noteRepository.findById(noteId);
    if (!note || !note.workspaceId) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const workspace = await workspaceRepository.findById(note.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${note.workspaceId}`);
    }

    // Create temp file from buffer/base64
    const ext = path.extname(filename) || '.png';
    const tempPath = path.join(workspace.folderPath, '.temp', `${crypto.randomUUID()}${ext}`);

    await fileStorage.createDirectory(path.dirname(tempPath));

    const buffer = typeof imageData === 'string' ? Buffer.from(imageData, 'base64') : imageData;
    await fileStorage.write(tempPath, buffer.toString('base64'));

    // Use addAttachment to handle the rest
    const attachment = await this.addAttachment(noteId, tempPath, filename);

    // Clean up temp file
    await fileStorage.delete(tempPath);

    // Generate markdown link
    const markdownLink = `![${attachment.originalName}](${attachment.path})`;

    return { attachment, markdownLink };
  }
}

export function createAttachmentUseCases(deps: AttachmentUseCasesDeps): IAttachmentUseCases {
  return new AttachmentUseCasesImpl(deps);
}
