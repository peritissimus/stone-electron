/**
 * Notebook Domain Entity
 *
 * Pure domain object representing a notebook (folder) with its business rules.
 * Independent of database schema and infrastructure concerns.
 *
 * PURE DOMAIN - No external dependencies.
 */

import { NotebookValidationError, NotebookOperationError } from '../errors';

export interface NotebookProps {
  id: string;
  name: string;
  parentId: string | null;
  workspaceId: string | null;
  folderPath: string | null;
  icon: string;
  color: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotebookProps {
  id: string; // ID must be provided (generated at application layer)
  name: string;
  parentId?: string;
  workspaceId?: string;
  folderPath?: string;
  icon?: string;
  color?: string;
  position?: number;
}

/**
 * Notebook Entity - Core domain object
 */
export class NotebookEntity {
  private props: NotebookProps;

  private constructor(props: NotebookProps) {
    this.props = props;
  }

  // Factory methods
  static create(props: CreateNotebookProps): NotebookEntity {
    if (!props.id || props.id.trim().length === 0) {
      throw new NotebookValidationError('Notebook ID is required');
    }
    if (!props.name || props.name.trim().length === 0) {
      throw new NotebookValidationError('Notebook name cannot be empty');
    }

    const now = new Date();
    return new NotebookEntity({
      id: props.id,
      name: props.name.trim(),
      parentId: props.parentId || null,
      workspaceId: props.workspaceId || null,
      folderPath: props.folderPath || null,
      icon: props.icon || '📁',
      color: props.color || '#3b82f6',
      position: props.position ?? 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: NotebookProps): NotebookEntity {
    return new NotebookEntity(props);
  }

  // Getters
  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get parentId(): string | null {
    return this.props.parentId;
  }

  get workspaceId(): string | null {
    return this.props.workspaceId;
  }

  get folderPath(): string | null {
    return this.props.folderPath;
  }

  get icon(): string {
    return this.props.icon;
  }

  get color(): string {
    return this.props.color;
  }

  get position(): number {
    return this.props.position;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get isRoot(): boolean {
    return this.props.parentId === null;
  }

  // Business Logic Methods

  /**
   * Rename the notebook
   */
  rename(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new NotebookValidationError('Notebook name cannot be empty');
    }
    const trimmedName = newName.trim();
    if (trimmedName.length > 100) {
      throw new NotebookValidationError('Notebook name cannot exceed 100 characters');
    }
    if (/[<>:"/\\|?*]/.test(trimmedName)) {
      throw new NotebookValidationError('Notebook name contains invalid characters');
    }
    this.props.name = trimmedName;
    this.markUpdated();
  }

  /**
   * Move notebook to a different parent
   */
  moveTo(newParentId: string | null): void {
    if (newParentId === this.props.id) {
      throw new NotebookOperationError('Cannot move notebook into itself');
    }
    this.props.parentId = newParentId;
    this.markUpdated();
  }

  /**
   * Update the folder path
   */
  updateFolderPath(folderPath: string): void {
    this.props.folderPath = folderPath;
    this.markUpdated();
  }

  /**
   * Change the notebook icon
   */
  changeIcon(icon: string): void {
    if (!icon || icon.trim().length === 0) {
      throw new NotebookValidationError('Icon cannot be empty');
    }
    this.props.icon = icon.trim();
    this.markUpdated();
  }

  /**
   * Change the notebook color
   */
  changeColor(color: string): void {
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      throw new NotebookValidationError('Invalid color format. Use hex format (e.g., #3b82f6)');
    }
    this.props.color = color;
    this.markUpdated();
  }

  /**
   * Update the position for ordering
   */
  setPosition(position: number): void {
    if (position < 0) {
      throw new NotebookValidationError('Position cannot be negative');
    }
    this.props.position = position;
    this.markUpdated();
  }

  /**
   * Check if a notebook can be a parent of this notebook
   */
  canHaveParent(potentialParentId: string, getAncestors: (id: string) => string[]): boolean {
    if (potentialParentId === this.props.id) {
      return false;
    }
    const ancestors = getAncestors(potentialParentId);
    return !ancestors.includes(this.props.id);
  }

  /**
   * Convert to plain object for persistence
   */
  toPersistence(): NotebookProps {
    return { ...this.props };
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): NotebookProps {
    return { ...this.props };
  }

  private markUpdated(): void {
    this.props.updatedAt = new Date();
  }
}
