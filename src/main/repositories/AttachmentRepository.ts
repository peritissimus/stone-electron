/**
 * AttachmentRepository - Handles file attachment metadata
 */

import Database from 'better-sqlite3'
import { BaseRepository } from './BaseRepository'
import type { Attachment } from '@shared/types'

/**
 * Attachment Repository
 */
export class AttachmentRepository extends BaseRepository<Attachment> {
  protected tableName = 'attachments'

  /**
   * Get all attachments for a note
   */
  getAttachmentsForNote(noteId: string): Attachment[] {
    return this.findAll({
      where: { noteId: noteId },
      sort: { field: 'created_at', order: 'DESC' },
    })
  }

  /**
   * Get attachment by filename for a note
   */
  getByFilename(noteId: string, filename: string): Attachment | null {
    return this.findOne({
      noteId: noteId,
      filename,
    })
  }

  /**
   * Get total size of attachments for a note
   */
  getTotalSizeForNote(noteId: string): number {
    const stmt = this.db.prepare(`
      SELECT SUM(size) as total_size
      FROM attachments
      WHERE noteId = ?
    `)
    const result = stmt.get(noteId) as { total_size: number | null }
    return result.total_size || 0
  }

  /**
   * Get total size of all attachments
   */
  getTotalSize(): number {
    const stmt = this.db.prepare('SELECT SUM(size) as total_size FROM attachments')
    const result = stmt.get() as { total_size: number | null }
    return result.total_size || 0
  }

  /**
   * Delete all attachments for a note
   */
  deleteForNote(noteId: string): number {
    const stmt = this.db.prepare('DELETE FROM attachments WHERE noteId = ?')
    const result = stmt.run(noteId)
    return result.changes || 0
  }

  /**
   * Get attachments by MIME type
   */
  getByMimeType(mimeType: string): Attachment[] {
    return this.findAll({
      where: { mimetype: mimeType },
      sort: { field: 'created_at', order: 'DESC' },
    })
  }

  /**
   * Get attachments by MIME type pattern
   */
  getByMimeTypePattern(pattern: string): Attachment[] {
    const stmt = this.db.prepare(`
      SELECT * FROM attachments
      WHERE mimetype LIKE ?
      ORDER BY created_at DESC
    `)
    return stmt.all(`${pattern}%`) as Attachment[]
  }

  /**
   * Get image attachments
   */
  getImages(): Attachment[] {
    return this.getByMimeTypePattern('image/')
  }

  /**
   * Get document attachments
   */
  getDocuments(): Attachment[] {
    const stmt = this.db.prepare(`
      SELECT * FROM attachments
      WHERE mimetype LIKE 'application/%'
         OR mimetype LIKE 'text/%'
      ORDER BY created_at DESC
    `)
    return stmt.all() as Attachment[]
  }

  /**
   * Get recent attachments
   */
  getRecent(limit: number = 20): Attachment[] {
    return this.findAll({
      sort: { field: 'created_at', order: 'DESC' },
      limit,
    })
  }

  /**
   * Get largest attachments
   */
  getLargest(limit: number = 10): Attachment[] {
    return this.findAll({
      sort: { field: 'size', order: 'DESC' },
      limit,
    })
  }

  /**
   * Search attachments by filename
   */
  searchByFilename(query: string): Attachment[] {
    const stmt = this.db.prepare(`
      SELECT * FROM attachments
      WHERE filename LIKE ?
      ORDER BY created_at DESC
    `)
    return stmt.all(`%${query}%`) as Attachment[]
  }

  /**
   * Get attachment count by MIME type
   */
  getCountByMimeType(): Array<{
    mimetype: string
    count: number
    total_size: number
  }> {
    const stmt = this.db.prepare(`
      SELECT
        mimetype,
        COUNT(*) as count,
        SUM(size) as total_size
      FROM attachments
      GROUP BY mimetype
      ORDER BY count DESC
    `)
    return stmt.all() as Array<{
      mimetype: string
      count: number
      total_size: number
    }>
  }

  /**
   * Get orphaned attachments (notes that don't exist)
   */
  getOrphaned(): Attachment[] {
    const stmt = this.db.prepare(`
      SELECT a.* FROM attachments a
      LEFT JOIN notes n ON a.noteId = n.id
      WHERE n.id IS NULL
      ORDER BY a.created_at DESC
    `)
    return stmt.all() as Attachment[]
  }

  /**
   * Delete orphaned attachments
   */
  deleteOrphaned(): number {
    const stmt = this.db.prepare(`
      DELETE FROM attachments
      WHERE noteId NOT IN (SELECT id FROM notes)
    `)
    const result = stmt.run()
    return result.changes || 0
  }
}
