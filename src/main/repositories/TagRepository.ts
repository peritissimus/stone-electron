/**
 * TagRepository - Handles tag operations and note-tag associations
 */

import Database from 'better-sqlite3'
import { BaseRepository } from './BaseRepository'
import type { Tag } from '@shared/types'

interface TagWithCount extends Tag {
  note_count: number
}

/**
 * Tag Repository
 */
export class TagRepository extends BaseRepository<Tag> {
  protected tableName = 'tags'

  /**
   * Get all tags with note counts
   */
  getAllWithCounts(): TagWithCount[] {
    const stmt = this.db.prepare(`
      SELECT t.*, COUNT(nt.note_id) as note_count
      FROM tags t
      LEFT JOIN note_tags nt ON t.id = nt.tag_id
      LEFT JOIN notes n ON nt.note_id = n.id AND n.is_deleted = 0
      GROUP BY t.id
      ORDER BY t.name ASC
    `)
    return stmt.all() as TagWithCount[]
  }

  /**
   * Get tags for a specific note
   */
  getTagsForNote(noteId: string): Tag[] {
    const stmt = this.db.prepare(`
      SELECT t.* FROM tags t
      JOIN note_tags nt ON t.id = nt.tag_id
      WHERE nt.note_id = ?
      ORDER BY t.name ASC
    `)
    return stmt.all(noteId) as Tag[]
  }

  /**
   * Add a tag to a note
   */
  addToNote(noteId: string, tagId: string): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO note_tags (note_id, tag_id)
      VALUES (?, ?)
    `)
    stmt.run(noteId, tagId)
  }

  /**
   * Remove a tag from a note
   */
  removeFromNote(noteId: string, tagId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM note_tags
      WHERE note_id = ? AND tag_id = ?
    `)
    stmt.run(noteId, tagId)
  }

  /**
   * Set tags for a note (replace all existing tags)
   */
  setTagsForNote(noteId: string, tagIds: string[]): void {
    this.transaction(() => {
      // Remove all existing tags
      this.db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId)

      // Add new tags
      if (tagIds.length > 0) {
        const stmt = this.db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)')
        for (const tagId of tagIds) {
          stmt.run(noteId, tagId)
        }
      }
    })
  }

  /**
   * Find or create a tag by name
   */
  findOrCreate(name: string, color?: string): Tag {
    // Try to find existing tag
    const existing = this.findOne({ name })
    if (existing) return existing

    // Create new tag
    return this.create({ name, color } as Partial<Tag>)
  }

  /**
   * Get most used tags
   */
  getMostUsed(limit: number = 10): TagWithCount[] {
    const stmt = this.db.prepare(`
      SELECT t.*, COUNT(nt.note_id) as note_count
      FROM tags t
      JOIN note_tags nt ON t.id = nt.tag_id
      JOIN notes n ON nt.note_id = n.id AND n.is_deleted = 0
      GROUP BY t.id
      ORDER BY note_count DESC, t.name ASC
      LIMIT ?
    `)
    return stmt.all(limit) as TagWithCount[]
  }

  /**
   * Get unused tags
   */
  getUnused(): Tag[] {
    const stmt = this.db.prepare(`
      SELECT t.* FROM tags t
      LEFT JOIN note_tags nt ON t.id = nt.tag_id
      WHERE nt.tag_id IS NULL
      ORDER BY t.name ASC
    `)
    return stmt.all() as Tag[]
  }

  /**
   * Delete a tag and remove all associations
   */
  deleteWithAssociations(tagId: string): boolean {
    return this.transaction(() => {
      // Remove all note-tag associations
      this.db.prepare('DELETE FROM note_tags WHERE tag_id = ?').run(tagId)

      // Delete the tag
      return this.delete(tagId)
    })
  }

  /**
   * Search tags by name
   */
  searchByName(query: string): Tag[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tags
      WHERE name LIKE ?
      ORDER BY name ASC
    `)
    return stmt.all(`%${query}%`) as Tag[]
  }

  /**
   * Rename a tag
   */
  rename(tagId: string, newName: string): Tag {
    // Check if new name already exists
    const existing = this.findOne({ name: newName })
    if (existing && existing.id !== tagId) {
      throw new Error('Tag with this name already exists')
    }

    return this.update(tagId, { name: newName } as Partial<Tag>)
  }

  /**
   * Merge two tags (move all associations from source to target)
   */
  merge(sourceTagId: string, targetTagId: string): void {
    if (sourceTagId === targetTagId) {
      throw new Error('Cannot merge a tag with itself')
    }

    this.transaction(() => {
      // Get all notes associated with source tag
      const sourceNotes = this.db
        .prepare('SELECT note_id FROM note_tags WHERE tag_id = ?')
        .all(sourceTagId) as Array<{ note_id: string }>

      // Add target tag to all those notes (ignore duplicates)
      const insertStmt = this.db.prepare(`
        INSERT OR IGNORE INTO note_tags (note_id, tag_id)
        VALUES (?, ?)
      `)

      for (const { note_id } of sourceNotes) {
        insertStmt.run(note_id, targetTagId)
      }

      // Delete the source tag
      this.deleteWithAssociations(sourceTagId)
    })
  }

  /**
   * Get tags used with a specific tag (co-occurring tags)
   */
  getRelatedTags(tagId: string, limit: number = 10): TagWithCount[] {
    const stmt = this.db.prepare(`
      SELECT t.*, COUNT(DISTINCT nt2.note_id) as note_count
      FROM tags t
      JOIN note_tags nt ON t.id = nt.tag_id
      JOIN note_tags nt2 ON nt.note_id = nt2.note_id
      JOIN notes n ON nt.note_id = n.id AND n.is_deleted = 0
      WHERE nt2.tag_id = ? AND t.id != ?
      GROUP BY t.id
      ORDER BY note_count DESC, t.name ASC
      LIMIT ?
    `)
    return stmt.all(tagId, tagId, limit) as TagWithCount[]
  }
}
