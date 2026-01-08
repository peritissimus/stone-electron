/**
 * Workspace Domain Entity
 *
 * Pure domain object representing a workspace with its business rules.
 * A workspace represents a root folder containing notes and notebooks.
 *
 * PURE DOMAIN - No external dependencies.
 */

import { WorkspaceValidationError } from '../errors';

export interface WorkspaceProps {
  id: string;
  name: string;
  folderPath: string;
  isActive: boolean;
  createdAt: Date;
  lastAccessedAt: Date;
}

export interface CreateWorkspaceProps {
  id: string; // ID must be provided (generated at application layer)
  name: string;
  folderPath: string;
  isActive?: boolean;
}

/**
 * Workspace Entity - Core domain object
 */
export class WorkspaceEntity {
  private props: WorkspaceProps;

  private constructor(props: WorkspaceProps) {
    this.props = props;
  }

  // Factory methods
  static create(props: CreateWorkspaceProps): WorkspaceEntity {
    if (!props.id || props.id.trim().length === 0) {
      throw new WorkspaceValidationError('Workspace ID is required');
    }
    if (!props.name || props.name.trim().length === 0) {
      throw new WorkspaceValidationError('Workspace name cannot be empty');
    }
    if (!props.folderPath || props.folderPath.trim().length === 0) {
      throw new WorkspaceValidationError('Workspace folder path cannot be empty');
    }

    const now = new Date();
    return new WorkspaceEntity({
      id: props.id,
      name: props.name.trim(),
      folderPath: props.folderPath.trim(),
      isActive: props.isActive ?? false,
      createdAt: now,
      lastAccessedAt: now,
    });
  }

  static fromPersistence(props: WorkspaceProps): WorkspaceEntity {
    return new WorkspaceEntity(props);
  }

  // Getters
  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get folderPath(): string {
    return this.props.folderPath;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get lastAccessedAt(): Date {
    return this.props.lastAccessedAt;
  }

  // Business Logic Methods

  /**
   * Rename the workspace
   */
  rename(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new WorkspaceValidationError('Workspace name cannot be empty');
    }
    const trimmedName = newName.trim();
    if (trimmedName.length > 100) {
      throw new WorkspaceValidationError('Workspace name cannot exceed 100 characters');
    }
    this.props.name = trimmedName;
  }

  /**
   * Activate this workspace
   */
  activate(): void {
    this.props.isActive = true;
    this.props.lastAccessedAt = new Date();
  }

  /**
   * Deactivate this workspace
   */
  deactivate(): void {
    this.props.isActive = false;
  }

  /**
   * Record access to this workspace
   */
  recordAccess(): void {
    this.props.lastAccessedAt = new Date();
  }

  /**
   * Update the folder path (e.g., when workspace is moved)
   */
  updateFolderPath(newPath: string): void {
    if (!newPath || newPath.trim().length === 0) {
      throw new WorkspaceValidationError('Folder path cannot be empty');
    }
    this.props.folderPath = newPath.trim();
  }

  /**
   * Get the relative path within this workspace for a given absolute path
   */
  getRelativePath(absolutePath: string): string | null {
    if (!absolutePath.startsWith(this.props.folderPath)) {
      return null;
    }
    return absolutePath.slice(this.props.folderPath.length).replace(/^\//, '');
  }

  /**
   * Get the absolute path for a given relative path within this workspace
   */
  getAbsolutePath(relativePath: string): string {
    const cleanRelative = relativePath.replace(/^\//, '');
    return `${this.props.folderPath}/${cleanRelative}`;
  }

  /**
   * Convert to plain object for persistence
   */
  toPersistence(): WorkspaceProps {
    return { ...this.props };
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): WorkspaceProps {
    return { ...this.props };
  }
}

