/**
 * Attachment Use Cases Port
 *
 * Defines the contract for attachment operations.
 */

import { Context } from 'effect';
import type { Effect } from 'effect';
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
  execute(
    request: AddAttachmentRequest,
  ): Effect.Effect<AddAttachmentResponse, Error>;
}

export interface IUploadImageUseCase {
  execute(
    request: UploadImageRequest,
  ): Effect.Effect<UploadImageResponse, Error>;
}

export interface IGetAttachmentsUseCase {
  execute(
    request: GetAttachmentsRequest,
  ): Effect.Effect<GetAttachmentsResponse, Error>;
}

export interface IDeleteAttachmentUseCase {
  execute(request: DeleteAttachmentRequest): Effect.Effect<void, Error>;
}

/**
 * Aggregated attachment use cases interface for DI container
 */
export interface IAttachmentUseCases {
  addAttachment(
    noteId: string,
    filePath: string,
    filename?: string,
  ): Effect.Effect<{
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
  }, Error>;
  deleteAttachment(
    attachmentId: string,
    deleteFile?: boolean,
  ): Effect.Effect<void, Error>;
  getAttachments(noteId: string): Effect.Effect<
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
  , Error>;
  uploadImage(
    noteId: string,
    imageData: Buffer | string,
    filename: string,
    mimeType?: string,
  ): Effect.Effect<{
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
  }, Error>;
}

export const AttachmentUseCasesPort =
  Context.GenericTag<IAttachmentUseCases>('stone/IAttachmentUseCases');
