/**
 * Repository Module Exports
 */

import Database from 'better-sqlite3'
import { BaseRepository } from './BaseRepository'
import { NoteRepository } from './NoteRepository'
import { NotebookRepository } from './NotebookRepository'
import { TagRepository } from './TagRepository'
import { VersionRepository } from './VersionRepository'
import { AttachmentRepository } from './AttachmentRepository'
import { getDatabaseManager } from '../database'

export { BaseRepository } from './BaseRepository'
export type { QueryOptions } from './BaseRepository'
export { NoteRepository } from './NoteRepository'
export { NotebookRepository } from './NotebookRepository'
export { TagRepository } from './TagRepository'
export { VersionRepository } from './VersionRepository'
export { AttachmentRepository } from './AttachmentRepository'

/**
 * Repository Collection
 */
export class Repositories {
  public note: NoteRepository
  public notebook: NotebookRepository
  public tag: TagRepository
  public version: VersionRepository
  public attachment: AttachmentRepository

  constructor(db: Database.Database) {
    this.note = new NoteRepository(db)
    this.notebook = new NotebookRepository(db)
    this.tag = new TagRepository(db)
    this.version = new VersionRepository(db)
    this.attachment = new AttachmentRepository(db)
  }
}

// Singleton instance
let instance: Repositories | null = null

/**
 * Get or create repositories instance
 */
export function getRepositories(): Repositories {
  if (!instance) {
    const dbManager = getDatabaseManager()
    const db = dbManager.getDatabase()
    instance = new Repositories(db)
  }
  return instance
}
