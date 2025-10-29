/**
 * NoteRepository - Handles all note-related database operations
 */

import Database from 'better-sqlite3'
import { BaseRepository } from './BaseRepository'
import type { Note } from '@shared/types'

/**
 * Note Repository
 */
export class NoteRepository extends BaseRepository<Note> {
  protected tableName = 'notes'

  /**
   * Find notes by notebook
   */
  findByNotebook(notebookId: string): Note[] {
    return this.findAll({
      where: { notebook_id: notebookId, is_deleted: 0 },
      sort: { field: 'updated_at', order: 'DESC' },
    })
  }

  /**
   * Find notes by tag
   */
  findByTag(tagId: string): Note[] {
    const stmt = this.db.prepare(`
      SELECT n.* FROM notes n
      JOIN note_tags nt ON n.id = nt.note_id
      WHERE nt.tag_id = ? AND n.is_deleted = 0
      ORDER BY n.updated_at DESC
    `)
    return stmt.all(tagId) as Note[]
  }

  /**
   * Full-text search
   */
  searchFullText(query: string, limit: number = 50): Note[] {
    const stmt = this.db.prepare(`
      SELECT n.* FROM notes n
      JOIN notes_fts fts ON n.rowid = fts.rowid
      WHERE notes_fts MATCH ? AND n.is_deleted = 0
      ORDER BY rank
      LIMIT ?
    `)
    return stmt.all(query, limit) as Note[]
  }

  /**
   * Get favorite notes
   */
  getFavorites(): Note[] {
    return this.findAll({
      where: { is_favorite: 1, is_deleted: 0 },
      sort: { field: 'updated_at', order: 'DESC' },
    })
  }

  /**
   * Get pinned notes
   */
  getPinned(): Note[] {
    return this.findAll({
      where: { is_pinned: 1, is_deleted: 0 },
      sort: { field: 'updated_at', order: 'DESC' },
    })
  }

  /**
   * Get recent notes
   */
  getRecent(limit: number = 20): Note[] {
    return this.findAll({
      where: { is_deleted: 0 },
      sort: { field: 'updated_at', order: 'DESC' },
      limit,
    })
  }

  /**
   * Get deleted notes (trash)
   */
  getDeleted(): Note[] {
    return this.findAll({
      where: { is_deleted: 1 },
      sort: { field: 'deleted_at', order: 'DESC' },
    })
  }

  /**
   * Get archived notes
   */
  getArchived(): Note[] {
    return this.findAll({
      where: { is_archived: 1, is_deleted: 0 },
      sort: { field: 'updated_at', order: 'DESC' },
    })
  }

  /**
   * Soft delete a note
   */
  softDelete(id: string): Note {
    const now = Math.floor(Date.now() / 1000)
    return this.update(id, {
      is_deleted: 1,
      deleted_at: now,
    } as Partial<Note>)
  }

  /**
   * Restore a deleted note
   */
  restore(id: string): Note {
    return this.update(id, {
      is_deleted: 0,
      deleted_at: null,
    } as Partial<Note>)
  }

  /**
   * Permanently delete a note and all related data
   */
  permanentDelete(id: string): boolean {
    return this.transaction(() => {
      // Delete attachments
      this.db.prepare('DELETE FROM attachments WHERE note_id = ?').run(id)

      // Delete versions
      this.db.prepare('DELETE FROM note_versions WHERE note_id = ?').run(id)

      // Delete tags associations
      this.db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(id)

      // Delete links
      this.db.prepare('DELETE FROM note_links WHERE source_note_id = ? OR target_note_id = ?').run(id, id)

      // Delete the note
      return this.delete(id)
    })
  }

  /**
   * Toggle favorite status
   */
  toggleFavorite(id: string): Note {
    const note = this.findById(id)
    if (!note) throw new Error('Note not found')

    return this.update(id, {
      is_favorite: note.is_favorite ? 0 : 1,
    } as Partial<Note>)
  }

  /**
   * Toggle pin status
   */
  togglePin(id: string): Note {
    const note = this.findById(id)
    if (!note) throw new Error('Note not found')

    return this.update(id, {
      is_pinned: note.is_pinned ? 0 : 1,
    } as Partial<Note>)
  }

  /**
   * Toggle archive status
   */
  toggleArchive(id: string): Note {
    const note = this.findById(id)
    if (!note) throw new Error('Note not found')

    return this.update(id, {
      is_archived: note.is_archived ? 0 : 1,
    } as Partial<Note>)
  }

  /**
   * Get backlinks for a note
   */
  getBacklinks(noteId: string): Note[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT n.* FROM notes n
      JOIN note_links nl ON n.id = nl.source_note_id
      WHERE nl.target_note_id = ? AND n.is_deleted = 0
      ORDER BY n.updated_at DESC
    `)
    return stmt.all(noteId) as Note[]
  }

  /**
   * Get forward links from a note
   */
  getForwardLinks(noteId: string): Note[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT n.* FROM notes n
      JOIN note_links nl ON n.id = nl.target_note_id
      WHERE nl.source_note_id = ? AND n.is_deleted = 0
      ORDER BY n.updated_at DESC
    `)
    return stmt.all(noteId) as Note[]
  }

  /**
   * Add a link between two notes
   */
  addLink(sourceId: string, targetId: string): void {
    const now = Math.floor(Date.now() / 1000)
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO note_links (source_note_id, target_note_id, created_at)
      VALUES (?, ?, ?)
    `)
    stmt.run(sourceId, targetId, now)
  }

  /**
   * Remove a link between two notes
   */
  removeLink(sourceId: string, targetId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM note_links
      WHERE source_note_id = ? AND target_note_id = ?
    `)
    stmt.run(sourceId, targetId)
  }

  /**
   * Get notes with specific tags (AND logic)
   */
  findByTags(tagIds: string[]): Note[] {
    if (tagIds.length === 0) return []

    const placeholders = tagIds.map(() => '?').join(',')
    const stmt = this.db.prepare(`
      SELECT n.* FROM notes n
      WHERE n.id IN (
        SELECT note_id FROM note_tags
        WHERE tag_id IN (${placeholders})
        GROUP BY note_id
        HAVING COUNT(DISTINCT tag_id) = ?
      )
      AND n.is_deleted = 0
      ORDER BY n.updated_at DESC
    `)

    return stmt.all(...tagIds, tagIds.length) as Note[]
  }

  /**
   * Get notes created within a date range
   */
  findByDateRange(startDate: number, endDate: number, field: 'created_at' | 'updated_at' = 'created_at'): Note[] {
    const stmt = this.db.prepare(`
      SELECT * FROM notes
      WHERE ${field} BETWEEN ? AND ?
      AND is_deleted = 0
      ORDER BY ${field} DESC
    `)
    return stmt.all(startDate, endDate) as Note[]
  }
}
