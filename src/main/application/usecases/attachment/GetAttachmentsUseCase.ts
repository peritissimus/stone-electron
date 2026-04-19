import type { IAttachmentRepository } from '../../../domain/ports/out/IAttachmentRepository';

export interface GetAttachmentsResultItem {
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

export class GetAttachmentsUseCase {
  constructor(private readonly attachmentRepository: IAttachmentRepository) {}

  async execute(noteId: string): Promise<GetAttachmentsResultItem[]> {
    const attachments = await this.attachmentRepository.findByNoteId(noteId);

    return attachments.map((a) => ({
      id: a.id,
      noteId: a.noteId,
      filename: a.filename,
      originalName: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      path: a.path,
      isImage: a.mimeType.startsWith('image/'),
      isPdf: a.mimeType === 'application/pdf',
      createdAt: a.createdAt,
    }));
  }
}
