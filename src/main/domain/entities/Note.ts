/**
 * Note Domain Entity
 *
 * Pure domain object representing a note with its business rules.
 * Independent of database schema and infrastructure concerns.
 *
 * PURE DOMAIN - No external dependencies.
 */

import { NoteValidationError, NoteOperationError } from '../errors';

export interface NoteProps {
  id: string;
  title: string;
  filePath: string | null;
  notebookId: string | null;
  workspaceId: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNoteProps {
  id: string; // ID must be provided (generated at application layer)
  title?: string;
  filePath?: string;
  notebookId?: string;
  workspaceId?: string;
}

/**
 * Note Entity - Core domain object
 */
export class NoteEntity {
  private props: NoteProps;

  private constructor(props: NoteProps) {
    this.props = props;
  }

  // Factory methods
  static create(props: CreateNoteProps): NoteEntity {
    if (!props.id || props.id.trim().length === 0) {
      throw new NoteValidationError('Note ID is required');
    }

    const now = new Date();
    return new NoteEntity({
      id: props.id,
      title: props.title || 'Untitled',
      filePath: props.filePath || null,
      notebookId: props.notebookId || null,
      workspaceId: props.workspaceId || null,
      isFavorite: false,
      isPinned: false,
      isArchived: false,
      isDeleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: NoteProps): NoteEntity {
    return new NoteEntity(props);
  }

  // Getters
  get id(): string {
    return this.props.id;
  }

  get title(): string {
    return this.props.title;
  }

  get filePath(): string | null {
    return this.props.filePath;
  }

  get notebookId(): string | null {
    return this.props.notebookId;
  }

  get workspaceId(): string | null {
    return this.props.workspaceId;
  }

  get isFavorite(): boolean {
    return this.props.isFavorite;
  }

  get isPinned(): boolean {
    return this.props.isPinned;
  }

  get isArchived(): boolean {
    return this.props.isArchived;
  }

  get isDeleted(): boolean {
    return this.props.isDeleted;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business Logic Methods

  /**
   * Update the note title
   */
  updateTitle(newTitle: string): void {
    if (!newTitle || newTitle.trim().length === 0) {
      throw new NoteValidationError('Note title cannot be empty');
    }
    const trimmedTitle = newTitle.trim();
    if (trimmedTitle.length > 255) {
      throw new NoteValidationError('Note title cannot exceed 255 characters');
    }
    this.props.title = trimmedTitle;
    this.markUpdated();
  }

  /**
   * Move note to a different notebook
   */
  moveToNotebook(notebookId: string | null): void {
    if (this.props.isDeleted) {
      throw new NoteOperationError('Cannot move a deleted note');
    }
    this.props.notebookId = notebookId;
    this.markUpdated();
  }

  /**
   * Update the file path
   */
  updateFilePath(filePath: string): void {
    this.props.filePath = filePath;
    this.markUpdated();
  }

  /**
   * Toggle favorite status
   */
  toggleFavorite(): void {
    if (this.props.isDeleted) {
      throw new NoteOperationError('Cannot favorite a deleted note');
    }
    this.props.isFavorite = !this.props.isFavorite;
    this.markUpdated();
  }

  /**
   * Set favorite status explicitly
   */
  setFavorite(isFavorite: boolean): void {
    if (this.props.isDeleted) {
      throw new NoteOperationError('Cannot modify a deleted note');
    }
    this.props.isFavorite = isFavorite;
    this.markUpdated();
  }

  /**
   * Toggle pinned status
   */
  togglePinned(): void {
    if (this.props.isDeleted) {
      throw new NoteOperationError('Cannot pin a deleted note');
    }
    this.props.isPinned = !this.props.isPinned;
    this.markUpdated();
  }

  /**
   * Set pinned status explicitly
   */
  setPinned(isPinned: boolean): void {
    if (this.props.isDeleted) {
      throw new NoteOperationError('Cannot modify a deleted note');
    }
    this.props.isPinned = isPinned;
    this.markUpdated();
  }

  /**
   * Archive the note
   */
  archive(): void {
    if (this.props.isDeleted) {
      throw new NoteOperationError('Cannot archive a deleted note');
    }
    if (this.props.isArchived) {
      throw new NoteOperationError('Note is already archived');
    }
    this.props.isArchived = true;
    this.props.isPinned = false;
    this.markUpdated();
  }

  /**
   * Unarchive the note
   */
  unarchive(): void {
    if (!this.props.isArchived) {
      throw new NoteOperationError('Note is not archived');
    }
    this.props.isArchived = false;
    this.markUpdated();
  }

  /**
   * Set archive status explicitly
   */
  setArchived(isArchived: boolean): void {
    if (this.props.isDeleted) {
      throw new NoteOperationError('Cannot modify a deleted note');
    }
    this.props.isArchived = isArchived;
    if (isArchived) {
      this.props.isPinned = false;
    }
    this.markUpdated();
  }

  /**
   * Soft delete the note
   */
  delete(): void {
    if (this.props.isDeleted) {
      throw new NoteOperationError('Note is already deleted');
    }
    this.props.isDeleted = true;
    this.props.deletedAt = new Date();
    this.props.isFavorite = false;
    this.props.isPinned = false;
    this.markUpdated();
  }

  /**
   * Restore a deleted note
   */
  restore(): void {
    if (!this.props.isDeleted) {
      throw new NoteOperationError('Note is not deleted');
    }
    this.props.isDeleted = false;
    this.props.deletedAt = null;
    this.markUpdated();
  }

  /**
   * Check if note can be edited
   */
  canEdit(): boolean {
    return !this.props.isDeleted;
  }

  /**
   * Convert to plain object for persistence
   */
  toPersistence(): NoteProps {
    return { ...this.props };
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): NoteProps {
    return { ...this.props };
  }

  private markUpdated(): void {
    this.props.updatedAt = new Date();
  }
}
