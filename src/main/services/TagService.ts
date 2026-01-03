/**
 * TagService - Tag management
 *
 * Handles tag CRUD, note associations, and sorting.
 */

import { EVENTS } from '@shared/constants/ipcChannels';
import { logger } from '../utils/logger';
import type { Tag } from '@shared/types';
import type { TagRepository } from '../repositories/TagRepository';
import type { NoteRepository } from '../repositories/NoteRepository';
import type { EventBus } from './EventBus';

export interface CreateTagRequest {
  name: string;
  color?: string;
}

export interface TagWithCount extends Tag {
  note_count: number;
}

export type TagSortOrder = 'name' | 'count' | 'recent';

/**
 * Dependencies for TagService
 */
export interface TagServiceDeps {
  tagRepository: TagRepository;
  noteRepository: NoteRepository;
  eventBus: EventBus;
}

/**
 * TagService handles tag operations
 */
export class TagService {
  constructor(private readonly deps: TagServiceDeps) {}
  // ==========================================================================
  // Tag CRUD
  // ==========================================================================

  /**
   * Create a new tag
   */
  async createTag(data: CreateTagRequest): Promise<TagWithCount> {
    // Check for duplicates
    const existing = await this.deps.tagRepository.findOne({ name: data.name });
    if (existing) {
      throw new Error('Tag with this name already exists');
    }

    const tag = await this.deps.tagRepository.create({
      name: data.name,
      color: data.color || '#6b7280',
    });

    this.deps.eventBus.emit(EVENTS.TAG_CREATED, { tag });

    logger.info(`[TagService] Created tag: ${tag.name}`);

    return { ...tag, note_count: 0 };
  }

  /**
   * Delete a tag and its associations
   */
  async deleteTag(id: string): Promise<{ affectedNotes: number }> {
    const tag = await this.deps.tagRepository.findById(id);
    if (!tag) {
      throw new Error('Tag not found');
    }

    // Get affected note count before deletion
    const allTags = await this.deps.tagRepository.getAllWithCounts();
    const noteCount = allTags.find((t) => t.id === id)?.note_count || 0;

    await this.deps.tagRepository.deleteWithAssociations(id);

    this.deps.eventBus.emit(EVENTS.TAG_DELETED, { id });

    logger.info(`[TagService] Deleted tag: ${tag.name} (affected ${noteCount} notes)`);

    return { affectedNotes: noteCount };
  }

  // ==========================================================================
  // Tag Queries
  // ==========================================================================

  /**
   * Get all tags with counts, optionally sorted
   */
  async getAllTags(sort: TagSortOrder = 'name'): Promise<TagWithCount[]> {
    const tags = await this.deps.tagRepository.getAllWithCounts();

    // Sort based on request
    switch (sort) {
      case 'count':
        tags.sort((a, b) => b.note_count - a.note_count || a.name.localeCompare(b.name));
        break;
      case 'recent':
        tags.sort((a, b) => {
          const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
          const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
          return bTime - aTime;
        });
        break;
      default:
        tags.sort((a, b) => a.name.localeCompare(b.name));
    }

    return tags;
  }

  /**
   * Find a tag by ID
   */
  async findById(id: string): Promise<Tag | null> {
    const tag = await this.deps.tagRepository.findById(id);
    return tag ?? null;
  }

  /**
   * Find a tag by name
   */
  async findByName(name: string): Promise<Tag | null> {
    const tag = await this.deps.tagRepository.findOne({ name });
    return tag ?? null;
  }

  // ==========================================================================
  // Note Associations
  // ==========================================================================

  /**
   * Add tags to a note
   */
  async addTagsToNote(noteId: string, tagIds: string[]): Promise<Tag[]> {
    // Verify note exists
    const note = await this.deps.noteRepository.findById(noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    // Add each tag
    for (const tagId of tagIds) {
      await this.deps.tagRepository.addToNote(noteId, tagId);
    }

    const tags = await this.deps.tagRepository.getTagsForNote(noteId);

    logger.info(`[TagService] Added ${tagIds.length} tags to note ${noteId}`);

    return tags;
  }

  /**
   * Remove a tag from a note
   */
  async removeTagFromNote(noteId: string, tagId: string): Promise<void> {
    await this.deps.tagRepository.removeFromNote(noteId, tagId);

    logger.info(`[TagService] Removed tag ${tagId} from note ${noteId}`);
  }

  /**
   * Get tags for a note
   */
  async getTagsForNote(noteId: string): Promise<Tag[]> {
    return this.deps.tagRepository.getTagsForNote(noteId);
  }

  /**
   * Set all tags for a note (replaces existing)
   */
  async setTagsForNote(noteId: string, tagNames: string[]): Promise<void> {
    await this.deps.tagRepository.setTagsForNote(noteId, tagNames);

    logger.info(`[TagService] Set ${tagNames.length} tags for note ${noteId}`);
  }
}

// ==========================================================================
// Singleton for backward compatibility (IPC handlers)
// ==========================================================================

import { getRepositories } from '../repositories';
import { getEventBus } from './EventBus';

let instance: TagService | null = null;

export function getTagService(): TagService {
  if (!instance) {
    const repos = getRepositories();
    instance = new TagService({
      tagRepository: repos.tag,
      noteRepository: repos.note,
      eventBus: getEventBus(),
    });
  }
  return instance;
}

/**
 * Create TagService with custom dependencies (for DI container)
 */
export function createTagService(deps: TagServiceDeps): TagService {
  return new TagService(deps);
}
