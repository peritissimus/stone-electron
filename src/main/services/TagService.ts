/**
 * TagService - Tag management
 *
 * Handles tag CRUD, note associations, and sorting.
 */

import { getRepositories } from '../repositories';
import { getEventBus } from './EventBus';
import { EVENTS } from '@shared/constants/ipcChannels';
import { logger } from '../utils/logger';
import type { Tag } from '@shared/types';

export interface CreateTagRequest {
  name: string;
  color?: string;
}

export interface TagWithCount extends Tag {
  note_count: number;
}

export type TagSortOrder = 'name' | 'count' | 'recent';

/**
 * TagService handles tag operations
 */
class TagService {
  // ==========================================================================
  // Tag CRUD
  // ==========================================================================

  /**
   * Create a new tag
   */
  async createTag(data: CreateTagRequest): Promise<TagWithCount> {
    const repos = getRepositories();

    // Check for duplicates
    const existing = await repos.tag.findOne({ name: data.name });
    if (existing) {
      throw new Error('Tag with this name already exists');
    }

    const tag = await repos.tag.create({
      name: data.name,
      color: data.color || '#6b7280',
    });

    getEventBus().emit(EVENTS.TAG_CREATED, { tag });

    logger.info(`[TagService] Created tag: ${tag.name}`);

    return { ...tag, note_count: 0 };
  }

  /**
   * Delete a tag and its associations
   */
  async deleteTag(id: string): Promise<{ affectedNotes: number }> {
    const repos = getRepositories();

    const tag = await repos.tag.findById(id);
    if (!tag) {
      throw new Error('Tag not found');
    }

    // Get affected note count before deletion
    const allTags = await repos.tag.getAllWithCounts();
    const noteCount = allTags.find((t) => t.id === id)?.note_count || 0;

    await repos.tag.deleteWithAssociations(id);

    getEventBus().emit(EVENTS.TAG_DELETED, { id });

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
    const repos = getRepositories();
    const tags = await repos.tag.getAllWithCounts();

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
    const repos = getRepositories();
    const tag = await repos.tag.findById(id);
    return tag ?? null;
  }

  /**
   * Find a tag by name
   */
  async findByName(name: string): Promise<Tag | null> {
    const repos = getRepositories();
    const tag = await repos.tag.findOne({ name });
    return tag ?? null;
  }

  // ==========================================================================
  // Note Associations
  // ==========================================================================

  /**
   * Add tags to a note
   */
  async addTagsToNote(noteId: string, tagIds: string[]): Promise<Tag[]> {
    const repos = getRepositories();

    // Verify note exists
    const note = await repos.note.findById(noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    // Add each tag
    for (const tagId of tagIds) {
      await repos.tag.addToNote(noteId, tagId);
    }

    const tags = await repos.tag.getTagsForNote(noteId);

    logger.info(`[TagService] Added ${tagIds.length} tags to note ${noteId}`);

    return tags;
  }

  /**
   * Remove a tag from a note
   */
  async removeTagFromNote(noteId: string, tagId: string): Promise<void> {
    const repos = getRepositories();
    await repos.tag.removeFromNote(noteId, tagId);

    logger.info(`[TagService] Removed tag ${tagId} from note ${noteId}`);
  }

  /**
   * Get tags for a note
   */
  async getTagsForNote(noteId: string): Promise<Tag[]> {
    const repos = getRepositories();
    return repos.tag.getTagsForNote(noteId);
  }

  /**
   * Set all tags for a note (replaces existing)
   */
  async setTagsForNote(noteId: string, tagNames: string[]): Promise<void> {
    const repos = getRepositories();
    await repos.tag.setTagsForNote(noteId, tagNames);

    logger.info(`[TagService] Set ${tagNames.length} tags for note ${noteId}`);
  }
}

// Singleton instance
let instance: TagService | null = null;

export function getTagService(): TagService {
  instance ??= new TagService();
  return instance;
}
