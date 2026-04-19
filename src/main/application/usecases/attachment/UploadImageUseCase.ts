import path from 'node:path';
import crypto from 'node:crypto';
import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import { AddAttachmentUseCase, type AddAttachmentResult } from './AddAttachmentUseCase';

export interface UploadImageResult {
  attachment: AddAttachmentResult;
  markdownLink: string;
}

export class UploadImageUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly addAttachmentUseCase: AddAttachmentUseCase,
  ) {}

  async execute(
    noteId: string,
    imageData: Buffer | string,
    filename: string,
    _mimeType?: string,
  ): Promise<UploadImageResult> {
    const note = await this.noteRepository.findById(noteId);
    if (!note || !note.workspaceId) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const workspace = await this.workspaceRepository.findById(note.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${note.workspaceId}`);
    }

    // Create temp file from buffer/base64
    const ext = path.extname(filename) || '.png';
    const tempPath = path.join(workspace.folderPath, '.temp', `${crypto.randomUUID()}${ext}`);

    await this.fileStorage.createDirectory(path.dirname(tempPath));

    const buffer = typeof imageData === 'string' ? Buffer.from(imageData, 'base64') : imageData;
    await this.fileStorage.write(tempPath, buffer.toString('base64'));

    // Use addAttachment to handle the rest
    const attachment = await this.addAttachmentUseCase.execute(noteId, tempPath, filename);

    // Clean up temp file
    await this.fileStorage.delete(tempPath);

    // Generate markdown link
    const markdownLink = `![${attachment.originalName}](${attachment.path})`;

    return { attachment, markdownLink };
  }
}
