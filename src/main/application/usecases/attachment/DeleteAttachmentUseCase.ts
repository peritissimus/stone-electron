import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IAttachmentRepository } from '../../../domain/ports/out/IAttachmentRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IPathService } from '../../../domain/ports/out/IPathService';

export class DeleteAttachmentUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly attachmentRepository: IAttachmentRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly pathService: IPathService,
  ) {}

  async execute(attachmentId: string, deleteFile: boolean = true): Promise<void> {
    const attachment = await this.attachmentRepository.findById(attachmentId);
    if (!attachment) {
      throw new Error(`Attachment not found: ${attachmentId}`);
    }

    if (deleteFile) {
      const note = await this.noteRepository.findById(attachment.noteId);
      if (note?.workspaceId) {
        const workspace = await this.workspaceRepository.findById(note.workspaceId);
        if (workspace) {
          const absolutePath = this.pathService.join(workspace.folderPath, attachment.path);
          await this.fileStorage.delete(absolutePath);
        }
      }
    }

    await this.attachmentRepository.delete(attachmentId);
  }
}
