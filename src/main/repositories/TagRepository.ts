/**
 * TagRepository - Handles tag operations and note-tag associations
 */

import { eq, sql, desc, asc, and } from 'drizzle-orm';
import { getDatabaseManager } from '../database/DatabaseManager';
import { tags, notes, noteTags } from '../database/schema';
import type { Tag, InsertTag } from '@shared/types';
import { nanoid } from 'nanoid';

interface TagWithCount extends Tag {
  noteCount: number;
}

/**
 * Tag Repository - Using Drizzle ORM
 */
export class TagRepository {
  /**
   * Create a new tag
   */
  async create(data: Partial<InsertTag>): Promise<Tag> {
    const db = getDatabaseManager().getDrizzle();
    const now = new Date();

    const newTag: InsertTag = {
      id: nanoid(),
      name: data.name!,
      color: data.color || '#6b7280',
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(tags).values(newTag);
    return newTag as Tag;
  }

  /**
   * Find tag by ID
   */
  async findById(id: string): Promise<Tag | undefined> {
    const db = getDatabaseManager().getDrizzle();
    const result = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
    return result[0];
  }

  /**
   * Find one tag matching conditions
   */
  async findOne(where: Partial<Tag>): Promise<Tag | undefined> {
    const db = getDatabaseManager().getDrizzle();

    const conditions = [];
    if (where.name) conditions.push(eq(tags.name, where.name));
    if (where.id) conditions.push(eq(tags.id, where.id));

    if (conditions.length === 0) return undefined;

    const result = await db
      .select()
      .from(tags)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .limit(1);

    return result[0];
  }

  /**
   * Update tag
   */
  async update(id: string, data: Partial<Tag>): Promise<Tag> {
    const db = getDatabaseManager().getDrizzle();
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };

    await db.update(tags).set(updateData).where(eq(tags.id, id));

    const updated = await this.findById(id);
    if (!updated) throw new Error('Tag not found after update');
    return updated;
  }

  /**
   * Delete tag
   */
  async delete(id: string): Promise<boolean> {
    const db = getDatabaseManager().getDrizzle();
    await db.delete(tags).where(eq(tags.id, id));
    return true;
  }

  /**
   * Execute operations in a transaction
   */
  async transaction<T>(callback: () => T | Promise<T>): Promise<T> {
    const db = getDatabaseManager().getDb();
    const result = db.transaction(() => {
      return callback();
    })();
    return result;
  }

  /**
   * Get all tags with note counts
   */
  async getAllWithCounts(): Promise<TagWithCount[]> {
    const db = getDatabaseManager().getDrizzle();

    const result = await db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
        createdAt: tags.createdAt,
        updatedAt: tags.updatedAt,
        noteCount: sql<number>`COUNT(${noteTags.noteId})`,
      })
      .from(tags)
      .leftJoin(noteTags, eq(tags.id, noteTags.tagId))
      .leftJoin(notes, sql`${noteTags.noteId} = ${notes.id} AND ${notes.isDeleted} = 0`)
      .groupBy(tags.id)
      .orderBy(asc(tags.name));

    return result as TagWithCount[];
  }

  /**
   * Get tags for a specific note
   */
  async getTagsForNote(noteId: string): Promise<Tag[]> {
    const db = getDatabaseManager().getDrizzle();

    const result = await db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
        createdAt: tags.createdAt,
        updatedAt: tags.updatedAt,
      })
      .from(tags)
      .innerJoin(noteTags, eq(tags.id, noteTags.tagId))
      .where(eq(noteTags.noteId, noteId))
      .orderBy(asc(tags.name));

    return result as Tag[];
  }

  /**
   * Add a tag to a note
   */
  async addToNote(noteId: string, tagId: string): Promise<void> {
    const db = getDatabaseManager().getDrizzle();
    const now = new Date();

    await db
      .insert(noteTags)
      .values({
        noteId,
        tagId,
        createdAt: now,
      })
      .onConflictDoNothing();
  }

  /**
   * Remove a tag from a note
   */
  async removeFromNote(noteId: string, tagId: string): Promise<void> {
    const db = getDatabaseManager().getDrizzle();

    await db
      .delete(noteTags)
      .where(and(eq(noteTags.noteId, noteId), eq(noteTags.tagId, tagId)));
  }

  /**
   * Set tags for a note (replace all existing tags)
   */
  async setTagsForNote(noteId: string, tagIds: string[]): Promise<void> {
    await this.transaction(async () => {
      const db = getDatabaseManager().getDrizzle();
      const now = new Date();

      // Remove all existing tags
      await db.delete(noteTags).where(eq(noteTags.noteId, noteId));

      // Add new tags
      if (tagIds.length > 0) {
        const values = tagIds.map(tagId => ({
          noteId,
          tagId,
          createdAt: now,
        }));
        await db.insert(noteTags).values(values);
      }
    });
  }

  /**
   * Delete a tag and remove all associations
   */
  async deleteWithAssociations(tagId: string): Promise<boolean> {
    return await this.transaction(async () => {
      const db = getDatabaseManager().getDrizzle();

      // Remove all note-tag associations (cascade should handle this, but being explicit)
      await db.delete(noteTags).where(eq(noteTags.tagId, tagId));

      // Delete the tag
      return await this.delete(tagId);
    });
  }
}
