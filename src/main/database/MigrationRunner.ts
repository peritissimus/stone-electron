/**
 * MigrationRunner - Handles database schema migrations
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

export interface Migration {
  version: number
  name: string
  path: string
}

/**
 * Migration Runner
 */
export class MigrationRunner {
  private db: Database.Database
  private migrationsDir: string

  constructor(db: Database.Database, dataPath: string) {
    this.db = db
    this.migrationsDir = path.join(dataPath, '..', '..', 'migrations')
    this.ensureMigrationsTable()
  }

  /**
   * Ensure schema_migrations table exists
   */
  private ensureMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        checksum TEXT NOT NULL
      );
    `)
  }

  /**
   * Get all applied migrations
   */
  private getAppliedMigrations(): Map<number, string> {
    const rows = this.db.prepare('SELECT version, name FROM schema_migrations ORDER BY version').all() as Array<{
      version: number
      name: string
    }>

    const map = new Map<number, string>()
    rows.forEach((row) => {
      map.set(row.version, row.name)
    })
    return map
  }

  /**
   * Get all migration files from disk
   */
  private getMigrationFiles(): Migration[] {
    if (!fs.existsSync(this.migrationsDir)) {
      return []
    }

    const files = fs.readdirSync(this.migrationsDir).filter((f) => f.match(/^\d+_.+\.sql$/))

    return files
      .sort()
      .map((f) => {
        const match = f.match(/^(\d+)_(.+)\.sql$/)
        if (!match) return null

        return {
          version: parseInt(match[1]),
          name: match[2],
          path: path.join(this.migrationsDir, f),
        }
      })
      .filter((m): m is Migration => m !== null)
  }

  /**
   * Get pending migrations
   */
  getPendingMigrations(): Migration[] {
    const applied = this.getAppliedMigrations()
    const allMigrations = this.getMigrationFiles()

    return allMigrations.filter((m) => !applied.has(m.version))
  }

  /**
   * Calculate SHA256 checksum of a file
   */
  private calculateChecksum(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8')
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  /**
   * Run a single migration
   */
  async run(migration: Migration): Promise<void> {
    try {
      const sql = fs.readFileSync(migration.path, 'utf-8')
      const checksum = this.calculateChecksum(migration.path)

      // Begin transaction
      const transaction = this.db.transaction(() => {
        // Split and execute SQL statements
        const statements = sql
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s && !s.startsWith('--'))

        for (const statement of statements) {
          this.db.exec(statement)
        }

        // Record migration
        this.db.prepare(
          `
            INSERT INTO schema_migrations (version, name, checksum)
            VALUES (?, ?, ?)
          `
        ).run(migration.version, migration.name, checksum)
      })

      // Execute transaction
      transaction()

      console.log(`✓ Migration ${migration.version} applied: ${migration.name}`)
    } catch (error) {
      console.error(`✗ Failed to apply migration ${migration.version}:`, error)
      throw new Error(`Migration failed: ${migration.name}`)
    }
  }

  /**
   * Get migration history
   */
  getMigrationHistory(): Array<{
    version: number
    name: string
    applied_at: number
  }> {
    return this.db
      .prepare(
        `
          SELECT version, name, applied_at
          FROM schema_migrations
          ORDER BY version ASC
        `
      )
      .all() as Array<{
      version: number
      name: string
      applied_at: number
    }>
  }

  /**
   * Get current schema version
   */
  getCurrentVersion(): number {
    const result = this.db.prepare('SELECT MAX(version) as version FROM schema_migrations').get() as {
      version: number | null
    }
    return result.version || 0
  }
}
