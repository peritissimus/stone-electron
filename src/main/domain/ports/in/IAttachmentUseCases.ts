/**
 * Attachment Use Cases Port
 *
 * Defines the contract for attachment operations.
 */

import type { AttachmentProps } from '../../entities';

// Request/Response types
export interface AddAttachmentRequest {
  noteId: string;
  filePath: string;
  filename?: string;
}

export interface AddAttachmentResponse {
  attachment: AttachmentProps;
}

export interface UploadImageRequest {
  noteId: string;
  imageData: string; // base64
  mimeType: string;
  filename?: string;
}

export interface UploadImageResponse {
  attachment: AttachmentProps;
  url: string;
}

export interface GetAttachmentsRequest {
  noteId: string;
}

export interface GetAttachmentsResponse {
  attachments: AttachmentProps[];
}

export interface DeleteAttachmentRequest {
  id: string;
  noteId: string;
}

// Use case interfaces
export interface IAddAttachmentUseCase {
  execute(request: AddAttachmentRequest): Promise<AddAttachmentResponse>;
}

export interface IUploadImageUseCase {
  execute(request: UploadImageRequest): Promise<UploadImageResponse>;
}

export interface IGetAttachmentsUseCase {
  execute(request: GetAttachmentsRequest): Promise<GetAttachmentsResponse>;
}

export interface IDeleteAttachmentUseCase {
  execute(request: DeleteAttachmentRequest): Promise<void>;
}

/**
 * Aggregated attachment use cases interface for DI container
 */
export interface IAttachmentUseCases {
  addAttachment(
    noteId: string,
    filePath: string,
    filename?: string,
  ): Promise<{
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
  }>;
  deleteAttachment(attachmentId: string, deleteFile?: boolean): Promise<void>;
  getAttachments(noteId: string): Promise<
    Array<{
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
    }>
  >;
  uploadImage(
    noteId: string,
    imageData: Buffer | string,
    filename: string,
    mimeType?: string,
  ): Promise<{
    attachment: {
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
    };
    markdownLink: string;
  }>;
}
