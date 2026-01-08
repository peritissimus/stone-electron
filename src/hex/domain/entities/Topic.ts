/**
 * Topic Domain Entity
 *
 * Represents an ML-based topic for note classification.
 *
 * PURE DOMAIN - No external dependencies.
 */

import { TopicValidationError } from '../errors';

export interface TopicProps {
  id: string;
  name: string;
  description: string | null;
  color: string;
  isPredefined: boolean;
  centroid: Uint8Array | null;
  noteCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTopicInput {
  id: string; // ID must be provided (generated at application layer)
  name: string;
  description?: string;
  color?: string;
  isPredefined?: boolean;
}

export interface TopicWithCount extends TopicProps {
  noteCount: number;
}

export class TopicEntity {
  private constructor(private props: TopicProps) {}

  // Getters
  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | null {
    return this.props.description;
  }

  get color(): string {
    return this.props.color;
  }

  get isPredefined(): boolean {
    return this.props.isPredefined;
  }

  get centroid(): Uint8Array | null {
    return this.props.centroid;
  }

  get noteCount(): number {
    return this.props.noteCount;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business logic
  rename(name: string): void {
    const normalized = TopicEntity.normalizeName(name);
    if (!normalized) {
      throw new TopicValidationError('Topic name cannot be empty');
    }
    this.props.name = normalized;
    this.props.updatedAt = new Date();
  }

  updateDescription(description: string | null): void {
    this.props.description = description?.trim() || null;
    this.props.updatedAt = new Date();
  }

  changeColor(color: string): void {
    if (!TopicEntity.isValidColor(color)) {
      throw new TopicValidationError('Invalid color format');
    }
    this.props.color = color;
    this.props.updatedAt = new Date();
  }

  updateCentroid(centroid: Uint8Array): void {
    this.props.centroid = centroid;
    this.props.updatedAt = new Date();
  }

  incrementNoteCount(): void {
    this.props.noteCount++;
    this.props.updatedAt = new Date();
  }

  decrementNoteCount(): void {
    if (this.props.noteCount > 0) {
      this.props.noteCount--;
      this.props.updatedAt = new Date();
    }
  }

  setNoteCount(count: number): void {
    this.props.noteCount = Math.max(0, count);
    this.props.updatedAt = new Date();
  }

  canDelete(): boolean {
    return !this.isPredefined;
  }

  // Static helpers
  static normalizeName(name: string): string {
    return name.trim();
  }

  static isValidColor(color: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  }

  static getDefaultColor(): string {
    return '#6366f1';
  }

  // Factory methods
  static create(input: CreateTopicInput): TopicEntity {
    if (!input.id || input.id.trim().length === 0) {
      throw new TopicValidationError('Topic ID is required');
    }

    const name = this.normalizeName(input.name);
    if (!name) {
      throw new TopicValidationError('Topic name cannot be empty');
    }

    const color = input.color || this.getDefaultColor();
    if (!this.isValidColor(color)) {
      throw new TopicValidationError('Invalid color format');
    }

    const now = new Date();

    return new TopicEntity({
      id: input.id,
      name,
      description: input.description?.trim() || null,
      color,
      isPredefined: input.isPredefined ?? false,
      centroid: null,
      noteCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: TopicProps): TopicEntity {
    return new TopicEntity(props);
  }

  toPersistence(): TopicProps {
    return { ...this.props };
  }
}
