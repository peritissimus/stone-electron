/**
 * VersionRepository - Handles note version history
 */

import Database from 'better-sqlite3'
import { BaseRepository } from './BaseRepository'
import type { NoteVersion } from '@shared/types'

/**
 * Version Repository
 */
export class VersionRepository extends BaseRepository<NoteVersion> {
  protected tableName = 'note_versions'

  /**
   * Create a new version snapshot
   */
  createVersion(noteId: string, title: string, content: string): NoteVersion {
    const versionNumber = this.getNextVersionNumber(noteId)

    return this.create({
      note_id: noteId,
      title,
      content,
      version_number: versionNumber,
    } as Partial<NoteVersion>)
  }

  /**
   * Get next version number for a note
   */
  private getNextVersionNumber(noteId: string): number {
    const stmt = this.db.prepare(`
      SELECT MAX(version_number) as max_version
      FROM note_versions
      WHERE note_id = ?
    `)
    const result = stmt.get(noteId) as { max_version: number | null }
    return (result.max_version || 0) + 1
  }

  /**
   * Get all versions for a note
   */
  getVersionsForNote(noteId: string, limit?: number, offset?: number): NoteVersion[] {
    const stmt = this.db.prepare(`
      SELECT * FROM note_versions
      WHERE note_id = ?
      ORDER BY version_number DESC
      ${limit ? `LIMIT ${limit}` : ''}
      ${offset ? `OFFSET ${offset}` : ''}
    `)
    return stmt.all(noteId) as NoteVersion[]
  }

  /**
   * Get a specific version
   */
  getVersion(noteId: string, versionNumber: number): NoteVersion | null {
    const stmt = this.db.prepare(`
      SELECT * FROM note_versions
      WHERE note_id = ? AND version_number = ?
    `)
    const result = stmt.get(noteId, versionNumber) as NoteVersion | undefined
    return result || null
  }

  /**
   * Get latest version for a note
   */
  getLatestVersion(noteId: string): NoteVersion | null {
    const stmt = this.db.prepare(`
      SELECT * FROM note_versions
      WHERE note_id = ?
      ORDER BY version_number DESC
      LIMIT 1
    `)
    const result = stmt.get(noteId) as NoteVersion | undefined
    return result || null
  }

  /**
   * Count versions for a note
   */
  countVersionsForNote(noteId: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM note_versions
      WHERE note_id = ?
    `)
    const result = stmt.get(noteId) as { count: number }
    return result.count
  }

  /**
   * Delete old versions (keep only the last N versions)
   */
  pruneOldVersions(noteId: string, keepCount: number = 10): number {
    const stmt = this.db.prepare(`
      DELETE FROM note_versions
      WHERE note_id = ?
      AND version_number < (
        SELECT MAX(version_number) - ? FROM note_versions WHERE note_id = ?
      )
    `)
    const result = stmt.run(noteId, keepCount, noteId)
    return result.changes || 0
  }

  /**
   * Delete all versions for a note
   */
  deleteVersionsForNote(noteId: string): number {
    const stmt = this.db.prepare('DELETE FROM note_versions WHERE note_id = ?')
    const result = stmt.run(noteId)
    return result.changes || 0
  }

  /**
   * Get version history summary
   */
  getVersionSummary(noteId: string): Array<{
    version_number: number
    title: string
    created_at: number
    content_length: number
  }> {
    const stmt = this.db.prepare(`
      SELECT
        version_number,
        title,
        created_at,
        LENGTH(content) as content_length
      FROM note_versions
      WHERE note_id = ?
      ORDER BY version_number DESC
    `)
    return stmt.all(noteId) as Array<{
      version_number: number
      title: string
      created_at: number
      content_length: number
    }>
  }

  /**
   * Compare two versions
   */
  compareVersions(
    noteId: string,
    version1: number,
    version2: number
  ): {
    version1: NoteVersion | null
    version2: NoteVersion | null
  } {
    const v1 = this.getVersion(noteId, version1)
    const v2 = this.getVersion(noteId, version2)

    return {
      version1: v1,
      version2: v2,
    }
  }

  /**
   * Get total storage used by versions for a note
   */
  getStorageSize(noteId: string): number {
    const stmt = this.db.prepare(`
      SELECT SUM(LENGTH(content)) as total_size
      FROM note_versions
      WHERE note_id = ?
    `)
    const result = stmt.get(noteId) as { total_size: number | null }
    return result.total_size || 0
  }

  /**
   * Get notes with most versions
   */
  getNotesWithMostVersions(limit: number = 10): Array<{
    note_id: string
    version_count: number
  }> {
    const stmt = this.db.prepare(`
      SELECT note_id, COUNT(*) as version_count
      FROM note_versions
      GROUP BY note_id
      ORDER BY version_count DESC
      LIMIT ?
    `)
    return stmt.all(limit) as Array<{
      note_id: string
      version_count: number
    }>
  }
}
