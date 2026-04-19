import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IAttachmentRepository } from '../../../domain/ports/out/IAttachmentRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IAttachmentUseCases } from '../../../domain/ports/in/IAttachmentUseCases';
import { AddAttachmentUseCase } from './AddAttachmentUseCase';
import { DeleteAttachmentUseCase } from './DeleteAttachmentUseCase';
import { GetAttachmentsUseCase } from './GetAttachmentsUseCase';
import { UploadImageUseCase } from './UploadImageUseCase';

export { AddAttachmentUseCase } from './AddAttachmentUseCase';
export { DeleteAttachmentUseCase } from './DeleteAttachmentUseCase';
export { GetAttachmentsUseCase } from './GetAttachmentsUseCase';
export { UploadImageUseCase } from './UploadImageUseCase';

export interface AttachmentUseCasesDeps {
  noteRepository: INoteRepository;
  attachmentRepository: IAttachmentRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
}

export function createAttachmentUseCases(deps: AttachmentUseCasesDeps): IAttachmentUseCases {
  const { noteRepository, attachmentRepository, workspaceRepository, fileStorage } = deps;

  const addAttachmentUseCase = new AddAttachmentUseCase(
    noteRepository,
    attachmentRepository,
    workspaceRepository,
    fileStorage,
  );
  const deleteAttachmentUseCase = new DeleteAttachmentUseCase(
    noteRepository,
    attachmentRepository,
    workspaceRepository,
    fileStorage,
  );
  const getAttachmentsUseCase = new GetAttachmentsUseCase(attachmentRepository);
  const uploadImageUseCase = new UploadImageUseCase(
    noteRepository,
    workspaceRepository,
    fileStorage,
    addAttachmentUseCase,
  );

  return {
    addAttachment: (noteId, filePath, filename) =>
      addAttachmentUseCase.execute(noteId, filePath, filename),
    deleteAttachment: (attachmentId, deleteFile) =>
      deleteAttachmentUseCase.execute(attachmentId, deleteFile),
    getAttachments: (noteId) => getAttachmentsUseCase.execute(noteId),
    uploadImage: (noteId, imageData, filename, mimeType) =>
      uploadImageUseCase.execute(noteId, imageData, filename, mimeType),
  };
}
