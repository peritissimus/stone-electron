/**
 * DatabaseManager - Core database connection and lifecycle management
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { MigrationRunner } from './MigrationRunner'
import { BackupManager } from './BackupManager'

/**
 * Database Manager - Handles initialization, migrations, and lifecycle
 */
export class DatabaseManager {
  private db: Database.Database | null = null
  private migrationRunner: MigrationRunner | null = null
  private backupManager: BackupManager | null = null
  private dataPath: string
  private dbPath: string

  constructor() {
    this.dataPath = path.join(app.getPath('userData'), 'stone-data')
    this.dbPath = path.join(this.dataPath, 'notes.db')

    // Ensure data directory exists
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true })
    }
  }

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing database...')

      // Open database
      this.db = new Database(this.dbPath)

      // Enable foreign keys
      this.db.pragma('foreign_keys = ON')

      // Initialize managers
      this.migrationRunner = new MigrationRunner(this.db, this.dataPath)
      this.backupManager = new BackupManager(this.dataPath)

      // Check and run pending migrations
      const pending = this.migrationRunner.getPendingMigrations()
      if (pending.length > 0) {
        console.log(`Found ${pending.length} pending migrations`)

        // Create backup before migration
        console.log('Creating backup before migration...')
        await this.backupManager.createBackup('pre-migration')

        // Run migrations
        for (const migration of pending) {
          console.log(`Running migration: ${migration.name}`)
          await this.migrationRunner.run(migration)
        }

        console.log('Migrations completed successfully')
      }

      console.log('Database initialized successfully')
    } catch (error) {
      console.error('Failed to initialize database:', error)
      throw error
    }
  }

  /**
   * Get the database instance
   */
  getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized')
    }
    return this.db
  }

  /**
   * Get the migration runner
   */
  getMigrationRunner(): MigrationRunner {
    if (!this.migrationRunner) {
      throw new Error('MigrationRunner not initialized')
    }
    return this.migrationRunner
  }

  /**
   * Get the backup manager
   */
  getBackupManager(): BackupManager {
    if (!this.backupManager) {
      throw new Error('BackupManager not initialized')
    }
    return this.backupManager
  }

  /**
   * Execute a query
   */
  exec(sql: string): void {
    this.getDatabase().exec(sql)
  }

  /**
   * Prepare a statement
   */
  prepare(sql: string): Database.Statement {
    return this.getDatabase().prepare(sql)
  }

  /**
   * Run a transaction
   */
  transaction<T>(callback: () => T): T {
    const db = this.getDatabase()
    const transaction = db.transaction(callback)
    return transaction()
  }

  /**
   * Get database status
   */
  getStatus(): {
    version: number
    note_count: number
    notebook_count: number
    tag_count: number
    attachment_count: number
    database_size: number
    integrity_ok: boolean
  } {
    const db = this.getDatabase()

    // Get counts
    const noteCount = db.prepare('SELECT COUNT(*) as count FROM notes WHERE is_deleted = 0').get() as { count: number }
    const notebookCount = db.prepare('SELECT COUNT(*) as count FROM notebooks').get() as { count: number }
    const tagCount = db.prepare('SELECT COUNT(*) as count FROM tags').get() as { count: number }
    const attachmentCount = db.prepare('SELECT COUNT(*) as count FROM attachments').get() as { count: number }

    // Get schema version
    const schemaVersion = db.prepare('SELECT MAX(version) as version FROM schema_migrations').get() as { version: number | null }

    // Get database file size
    const stats = fs.statSync(this.dbPath)
    const databaseSize = stats.size

    return {
      version: schemaVersion.version || 0,
      note_count: noteCount.count,
      notebook_count: notebookCount.count,
      tag_count: tagCount.count,
      attachment_count: attachmentCount.count,
      database_size: databaseSize,
      integrity_ok: true,
    }
  }

  /**
   * Check database integrity
   */
  checkIntegrity(): {
    ok: boolean
    errors: string[]
  } {
    const db = this.getDatabase()

    try {
      const result = db.prepare('PRAGMA integrity_check').all() as Array<{ integrity_check: string }>

      if (result.length === 1 && result[0].integrity_check === 'ok') {
        return { ok: true, errors: [] }
      }

      return {
        ok: false,
        errors: result.map((r) => r.integrity_check),
      }
    } catch (error) {
      return {
        ok: false,
        errors: [String(error)],
      }
    }
  }

  /**
   * Optimize database (VACUUM + ANALYZE)
   */
  optimize(): void {
    const db = this.getDatabase()
    db.exec('VACUUM')
    db.exec('PRAGMA optimize')
    console.log('Database optimized')
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      console.log('Database closed')
    }
  }

  /**
   * Get data path
   */
  getDataPath(): string {
    return this.dataPath
  }

  /**
   * Get database path
   */
  getDbPath(): string {
    return this.dbPath
  }
}

// Singleton instance
let instance: DatabaseManager | null = null

/**
 * Get or create database manager instance
 */
export function getDatabaseManager(): DatabaseManager {
  if (!instance) {
    instance = new DatabaseManager()
  }
  return instance
}
