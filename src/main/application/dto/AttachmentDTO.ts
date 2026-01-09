/**
 * Attachment DTOs - Data transfer objects for file attachments
 */

/**
 * Attachment response
 */
export interface AttachmentDTO {
  id: string;
  noteId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  isImage: boolean;
  isPdf: boolean;
  createdAt: string;
}

/**
 * Add attachment request
 */
export interface AddAttachmentRequestDTO {
  noteId: string;
  filePath: string;
  filename?: string;
}

/**
 * Add attachment response
 */
export interface AddAttachmentResponseDTO {
  attachment: AttachmentDTO;
  relativePath: string;
}

/**
 * Delete attachment request
 */
export interface DeleteAttachmentRequestDTO {
  attachmentId: string;
  deleteFile?: boolean;
}

/**
 * Get attachments request
 */
export interface GetAttachmentsRequestDTO {
  noteId: string;
}

/**
 * Upload image request
 */
export interface UploadImageRequestDTO {
  noteId: string;
  imageData: Buffer | string; // Base64 or buffer
  filename: string;
  mimeType?: string;
}

/**
 * Upload image response
 */
export interface UploadImageResponseDTO {
  attachment: AttachmentDTO;
  markdownLink: string; // ![alt](path)
}
