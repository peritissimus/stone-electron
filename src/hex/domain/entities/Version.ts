/**
 * Version Domain Entity
 *
 * Represents a version snapshot of a note's content.
 *
 * PURE DOMAIN - No external dependencies.
 */

import { VersionValidationError } from '../errors';

export interface VersionProps {
  id: string;
  noteId: string;
  title: string;
  content: string;
  versionNumber: number;
  createdAt: Date;
}

export interface CreateVersionInput {
  id: string; // ID must be provided (generated at application layer)
  noteId: string;
  title: string;
  content: string;
  versionNumber: number;
}

export interface VersionSummary {
  id: string;
  versionNumber: number;
  title: string;
  createdAt: Date;
  contentLength: number;
}

export class VersionEntity {
  private constructor(private props: VersionProps) {}

  // Getters
  get id(): string {
    return this.props.id;
  }

  get noteId(): string {
    return this.props.noteId;
  }

  get title(): string {
    return this.props.title;
  }

  get content(): string {
    return this.props.content;
  }

  get versionNumber(): number {
    return this.props.versionNumber;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  // Business logic
  get contentLength(): number {
    return this.content.length;
  }

  get summary(): VersionSummary {
    return {
      id: this.id,
      versionNumber: this.versionNumber,
      title: this.title,
      createdAt: this.createdAt,
      contentLength: this.contentLength,
    };
  }

  get formattedVersion(): string {
    return `v${this.versionNumber}`;
  }

  isNewerThan(other: VersionEntity): boolean {
    return this.versionNumber > other.versionNumber;
  }

  // Factory methods
  static create(input: CreateVersionInput): VersionEntity {
    if (!input.id || input.id.trim().length === 0) {
      throw new VersionValidationError('Version ID is required');
    }

    return new VersionEntity({
      id: input.id,
      noteId: input.noteId,
      title: input.title,
      content: input.content,
      versionNumber: input.versionNumber,
      createdAt: new Date(),
    });
  }

  static fromPersistence(props: VersionProps): VersionEntity {
    return new VersionEntity(props);
  }

  toPersistence(): VersionProps {
    return { ...this.props };
  }
}
