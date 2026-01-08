/**
 * NoteLink Domain Entity
 *
 * Represents a wiki-style link between two notes.
 *
 * PURE DOMAIN - No external dependencies.
 */

import { NoteLinkValidationError } from '../errors';

export interface NoteLinkProps {
  sourceNoteId: string;
  targetNoteId: string;
  createdAt: Date;
}

export interface CreateNoteLinkInput {
  sourceNoteId: string;
  targetNoteId: string;
}

export interface LinkCount {
  incoming: number;
  outgoing: number;
}

export class NoteLinkEntity {
  private constructor(private props: NoteLinkProps) {}

  // Getters
  get sourceNoteId(): string {
    return this.props.sourceNoteId;
  }

  get targetNoteId(): string {
    return this.props.targetNoteId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  // Business logic
  isSelfLink(): boolean {
    return this.sourceNoteId === this.targetNoteId;
  }

  involvesNote(noteId: string): boolean {
    return this.sourceNoteId === noteId || this.targetNoteId === noteId;
  }

  isLinkFrom(noteId: string): boolean {
    return this.sourceNoteId === noteId;
  }

  isLinkTo(noteId: string): boolean {
    return this.targetNoteId === noteId;
  }

  // Validation
  static validate(input: CreateNoteLinkInput): void {
    if (!input.sourceNoteId || !input.targetNoteId) {
      throw new NoteLinkValidationError('Both source and target note IDs are required');
    }

    if (input.sourceNoteId === input.targetNoteId) {
      throw new NoteLinkValidationError('Cannot create a self-referencing link');
    }
  }

  // Factory methods
  static create(input: CreateNoteLinkInput): NoteLinkEntity {
    this.validate(input);

    return new NoteLinkEntity({
      sourceNoteId: input.sourceNoteId,
      targetNoteId: input.targetNoteId,
      createdAt: new Date(),
    });
  }

  static fromPersistence(props: NoteLinkProps): NoteLinkEntity {
    return new NoteLinkEntity(props);
  }

  toPersistence(): NoteLinkProps {
    return { ...this.props };
  }

  // Composite key for uniqueness
  get key(): string {
    return `${this.sourceNoteId}:${this.targetNoteId}`;
  }

  static makeKey(sourceId: string, targetId: string): string {
    return `${sourceId}:${targetId}`;
  }
}
