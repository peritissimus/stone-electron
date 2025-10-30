/**
 * TagRepository - Handles tag operations and note-tag associations
 */

import { eq, sql, desc, asc } from 'drizzle-orm';
import { getDatabaseManager } from '../database/DatabaseManager';
import { tags, notes, noteTags } from '../database/schema';
import type { Tag } from '@shared/types';

interface TagWithCount extends Tag {
  note_count: number;
}

/**
 * Tag Repository
 */
export class TagRepository {
  private db = getDatabaseManager().getDrizzle();

  /**
   * Get all tags with note counts
   */
  async getAllWithCounts(): Promise<TagWithCount[]> {
    const result = await this.db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
        created_at: tags.created_at,
        updated_at: tags.updated_at,
        note_count: sql<number>`COUNT(${noteTags.noteId})`,
      })
      .from(tags)
      .leftJoin(noteTags, eq(tags.id, noteTags.tagId))
      .leftJoin(notes, sql`${noteTags.noteId} = ${notes.id} AND ${notes.is_deleted} = 0`)
      .groupBy(tags.id)
      .orderBy(asc(tags.name));

    return result as TagWithCount[];
  }

  /**
   * Get tags for a specific note
   */
  getTagsForNote(noteId: string): Tag[] {
    const stmt = this.db.prepare(`
      SELECT t.* FROM tags t
      JOIN note_tags nt ON t.id = nt.tagId
      WHERE nt.noteId = ?
      ORDER BY t.name ASC
    `);
    return stmt.all(noteId) as Tag[];
  }

  /**
   * Add a tag to a note
   */
  addToNote(noteId: string, tagId: string): void {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO note_tags (noteId, tagId, created_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(noteId, tagId, now);
  }

  /**
   * Remove a tag from a note
   */
  removeFromNote(noteId: string, tagId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM note_tags
      WHERE noteId = ? AND tagId = ?
    `);
    stmt.run(noteId, tagId);
  }

  /**
   * Set tags for a note (replace all existing tags)
   */
  setTagsForNote(noteId: string, tagIds: string[]): void {
    this.transaction(() => {
      const now = Math.floor(Date.now() / 1000);

      // Remove all existing tags
      this.db.prepare('DELETE FROM note_tags WHERE noteId = ?').run(noteId);

      // Add new tags
      if (tagIds.length > 0) {
        const stmt = this.db.prepare(
          'INSERT INTO note_tags (noteId, tagId, created_at) VALUES (?, ?, ?)',
        );
        for (const tagId of tagIds) {
          stmt.run(noteId, tagId, now);
        }
      }
    });
  }

  /**
   * Find or create a tag by name
   */
  findOrCreate(name: string, color?: string): Tag {
    // Try to find existing tag
    const existing = this.findOne({ name });
    if (existing) return existing;

    // Create new tag
    return this.create({ name, color } as Partial<Tag>);
  }

  /**
   * Get most used tags
   */
  getMostUsed(limit: number = 10): TagWithCount[] {
    const stmt = this.db.prepare(`
      SELECT t.*, COUNT(nt.noteId) as note_count
      FROM tags t
      JOIN note_tags nt ON t.id = nt.tagId
      JOIN notes n ON nt.noteId = n.id AND n.is_deleted = 0
      GROUP BY t.id
      ORDER BY note_count DESC, t.name ASC
      LIMIT ?
    `);
    return stmt.all(limit) as TagWithCount[];
  }

  /**
   * Get unused tags
   */
  getUnused(): Tag[] {
    const stmt = this.db.prepare(`
      SELECT t.* FROM tags t
      LEFT JOIN note_tags nt ON t.id = nt.tagId
      WHERE nt.tagId IS NULL
      ORDER BY t.name ASC
    `);
    return stmt.all() as Tag[];
  }

  /**
   * Delete a tag and remove all associations
   */
  deleteWithAssociations(tagId: string): boolean {
    return this.transaction(() => {
      // Remove all note-tag associations
      this.db.prepare('DELETE FROM note_tags WHERE tagId = ?').run(tagId);

      // Delete the tag
      return this.delete(tagId);
    });
  }

  /**
   * Search tags by name
   */
  searchByName(query: string): Tag[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tags
      WHERE name LIKE ?
      ORDER BY name ASC
    `);
    return stmt.all(`%${query}%`) as Tag[];
  }

  /**
   * Rename a tag
   */
  rename(tagId: string, newName: string): Tag {
    // Check if new name already exists
    const existing = this.findOne({ name: newName });
    if (existing && existing.id !== tagId) {
      throw new Error('Tag with this name already exists');
    }

    return this.update(tagId, { name: newName } as Partial<Tag>);
  }

  /**
   * Merge two tags (move all associations from source to target)
   */
  merge(sourceTagId: string, targetTagId: string): void {
    if (sourceTagId === targetTagId) {
      throw new Error('Cannot merge a tag with itself');
    }

    this.transaction(() => {
      const now = Math.floor(Date.now() / 1000);

      // Get all notes associated with source tag
      const sourceNotes = this.db
        .prepare('SELECT noteId FROM note_tags WHERE tagId = ?')
        .all(sourceTagId) as Array<{ noteId: string }>;

      // Add target tag to all those notes (ignore duplicates)
      const insertStmt = this.db.prepare(`
        INSERT OR IGNORE INTO note_tags (noteId, tagId, created_at)
        VALUES (?, ?, ?)
      `);

      for (const { noteId } of sourceNotes) {
        insertStmt.run(noteId, targetTagId, now);
      }

      // Delete the source tag
      this.deleteWithAssociations(sourceTagId);
    });
  }

  /**
   * Get tags used with a specific tag (co-occurring tags)
   */
  getRelatedTags(tagId: string, limit: number = 10): TagWithCount[] {
    const stmt = this.db.prepare(`
      SELECT t.*, COUNT(DISTINCT nt2.noteId) as note_count
      FROM tags t
      JOIN note_tags nt ON t.id = nt.tagId
      JOIN note_tags nt2 ON nt.noteId = nt2.noteId
      JOIN notes n ON nt.noteId = n.id AND n.is_deleted = 0
      WHERE nt2.tagId = ? AND t.id != ?
      GROUP BY t.id
      ORDER BY note_count DESC, t.name ASC
      LIMIT ?
    `);
    return stmt.all(tagId, tagId, limit) as TagWithCount[];
  }
}
