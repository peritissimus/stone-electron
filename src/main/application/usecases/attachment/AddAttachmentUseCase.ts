import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IAttachmentRepository } from '../../../domain/ports/out/IAttachmentRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IIdGenerator } from '../../../domain/ports/out/IIdGenerator';
import type { IPathService } from '../../../domain/ports/out/IPathService';
import { AttachmentEntity } from '../../../domain/entities/Attachment';

export interface AddAttachmentResult {
  id: string;
  noteId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  isImage: boolean;
  isPdf: boolean;
  createdAt: Date;
}

export class AddAttachmentUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly attachmentRepository: IAttachmentRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly idGenerator: IIdGenerator,
    private readonly pathService: IPathService,
  ) {}

  async execute(noteId: string, filePath: string, filename?: string): Promise<AddAttachmentResult> {
    const note = await this.noteRepository.findById(noteId);
    if (!note || !note.workspaceId) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const workspace = await this.workspaceRepository.findById(note.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${note.workspaceId}`);
    }

    const originalName = filename || this.pathService.basename(filePath);
    const ext = this.pathService.extname(originalName);
    const uniqueFilename = `${this.idGenerator.generate()}${ext}`;
    const mimeType = AddAttachmentUseCase.getMimeType(ext);

    // Create attachments directory
    const attachmentsDir = this.pathService.join(workspace.folderPath, '.attachments', noteId);
    await this.fileStorage.createDirectory(attachmentsDir);

    // Copy file to attachments directory
    const destPath = this.pathService.join(attachmentsDir, uniqueFilename);
    await this.fileStorage.copy(filePath, destPath);

    // Get file info
    const fileInfo = await this.fileStorage.getFileInfo(destPath);

    // Create attachment entity
    const attachment = AttachmentEntity.create({
      id: this.idGenerator.generate(),
      noteId,
      filename: uniqueFilename,
      mimeType,
      size: fileInfo?.size || 0,
      path: this.pathService.relative(workspace.folderPath, destPath),
    });

    await this.attachmentRepository.save(attachment);

    return {
      id: attachment.id,
      noteId: attachment.noteId,
      filename: attachment.filename,
      originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      path: attachment.path,
      isImage: attachment.mimeType.startsWith('image/'),
      isPdf: attachment.mimeType === 'application/pdf',
      createdAt: attachment.createdAt,
    };
  }

  private static getMimeType(ext: string): string {
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
}
