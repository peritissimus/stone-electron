/**
 * Attachment Domain Entity
 *
 * Represents a file attachment linked to a note.
 *
 * PURE DOMAIN - No external dependencies.
 */

import { AttachmentValidationError } from '../errors';

export interface AttachmentProps {
  id: string;
  noteId: string;
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  createdAt: Date;
}

export interface CreateAttachmentInput {
  id: string; // ID must be provided (generated at application layer)
  noteId: string;
  filename: string;
  mimeType: string;
  size: number;
  path: string;
}

export class AttachmentEntity {
  private constructor(private props: AttachmentProps) {}

  // Getters
  get id(): string {
    return this.props.id;
  }

  get noteId(): string {
    return this.props.noteId;
  }

  get filename(): string {
    return this.props.filename;
  }

  get mimeType(): string {
    return this.props.mimeType;
  }

  get size(): number {
    return this.props.size;
  }

  get path(): string {
    return this.props.path;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  // Business logic
  get isImage(): boolean {
    return this.mimeType.startsWith('image/');
  }

  get isPdf(): boolean {
    return this.mimeType === 'application/pdf';
  }

  get extension(): string {
    const parts = this.filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  get formattedSize(): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = this.size;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
  }

  // Validation
  static validateFilename(filename: string): void {
    if (!filename || filename.trim().length === 0) {
      throw new AttachmentValidationError('Filename cannot be empty');
    }

    // Check for path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new AttachmentValidationError('Invalid filename: path traversal detected');
    }
  }

  // Factory methods
  static create(input: CreateAttachmentInput): AttachmentEntity {
    if (!input.id || input.id.trim().length === 0) {
      throw new AttachmentValidationError('Attachment ID is required');
    }
    this.validateFilename(input.filename);

    return new AttachmentEntity({
      id: input.id,
      noteId: input.noteId,
      filename: input.filename.trim(),
      mimeType: input.mimeType,
      size: input.size,
      path: input.path,
      createdAt: new Date(),
    });
  }

  static fromPersistence(props: AttachmentProps): AttachmentEntity {
    return new AttachmentEntity(props);
  }

  toPersistence(): AttachmentProps {
    return { ...this.props };
  }
}
