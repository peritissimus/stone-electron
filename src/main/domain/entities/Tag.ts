/**
 * Tag Domain Entity
 *
 * Pure domain object representing a tag with its business rules.
 * Independent of database schema and infrastructure concerns.
 *
 * PURE DOMAIN - No external dependencies.
 */

import { TagValidationError } from '../errors';

export interface TagProps {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTagProps {
  id: string; // ID must be provided (generated at application layer)
  name: string;
  color?: string;
}

/**
 * Tag Entity - Core domain object
 */
export class TagEntity {
  private props: TagProps;

  private constructor(props: TagProps) {
    this.props = props;
  }

  // Factory methods
  static create(props: CreateTagProps): TagEntity {
    if (!props.id || props.id.trim().length === 0) {
      throw new TagValidationError('Tag ID is required');
    }

    const normalizedName = TagEntity.normalizeName(props.name);
    if (!normalizedName) {
      throw new TagValidationError('Tag name cannot be empty');
    }

    const now = new Date();
    return new TagEntity({
      id: props.id,
      name: normalizedName,
      color: props.color || '#6b7280',
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: TagProps): TagEntity {
    return new TagEntity(props);
  }

  /**
   * Normalize tag name (lowercase, trim, remove special chars)
   */
  static normalizeName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\-_\s]/g, '')
      .replace(/\s+/g, '-');
  }

  // Getters
  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get color(): string {
    return this.props.color;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business Logic Methods

  /**
   * Rename the tag
   */
  rename(newName: string): void {
    const normalizedName = TagEntity.normalizeName(newName);
    if (!normalizedName) {
      throw new TagValidationError('Tag name cannot be empty');
    }
    if (normalizedName.length > 50) {
      throw new TagValidationError('Tag name cannot exceed 50 characters');
    }
    this.props.name = normalizedName;
    this.markUpdated();
  }

  /**
   * Change the tag color
   */
  changeColor(color: string): void {
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      throw new TagValidationError('Invalid color format. Use hex format (e.g., #6b7280)');
    }
    this.props.color = color;
    this.markUpdated();
  }

  /**
   * Check if this tag matches a search term
   */
  matches(searchTerm: string): boolean {
    const normalizedSearch = searchTerm.toLowerCase().trim();
    return this.props.name.includes(normalizedSearch);
  }

  /**
   * Convert to plain object for persistence
   */
  toPersistence(): TagProps {
    return { ...this.props };
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): TagProps {
    return { ...this.props };
  }

  private markUpdated(): void {
    this.props.updatedAt = new Date();
  }
}
