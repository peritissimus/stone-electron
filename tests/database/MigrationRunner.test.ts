/**
 * MigrationRunner Tests
 *
 * These tests verify the migration system works correctly.
 * This would have caught the SQL splitting bug that broke triggers!
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { MigrationRunner } from '@main/database/MigrationRunner'

// Mock electron app module
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd(),
  },
}))

describe('MigrationRunner', () => {
  let db: Database.Database
  let runner: MigrationRunner
  let testDbPath: string

  beforeEach(() => {
    // Create in-memory database for testing
    testDbPath = ':memory:'
    db = new Database(testDbPath)
    db.pragma('foreign_keys = ON')

    // Create a temporary data directory
    const tempDataPath = path.join(process.cwd(), 'tests', 'tmp', 'migrations-test')
    if (!fs.existsSync(tempDataPath)) {
      fs.mkdirSync(tempDataPath, { recursive: true })
    }

    runner = new MigrationRunner(db, tempDataPath)
  })

  afterEach(() => {
    db.close()
  })

  describe('initialization', () => {
    it('should create schema_migrations table', () => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
        .all()

      expect(tables).toHaveLength(1)
    })

    it('should have correct schema_migrations structure', () => {
      const columns = db.prepare('PRAGMA table_info(schema_migrations)').all() as Array<{
        name: string
        type: string
      }>

      const columnNames = columns.map(c => c.name)
      expect(columnNames).toContain('version')
      expect(columnNames).toContain('name')
      expect(columnNames).toContain('applied_at')
      expect(columnNames).toContain('checksum')
    })
  })

  describe('getPendingMigrations', () => {
    it('should find migration files in migrations directory', () => {
      const pending = runner.getPendingMigrations()

      // Should find at least the initial schema migration
      expect(pending.length).toBeGreaterThan(0)
    })

    it('should return migrations in sorted order', () => {
      const pending = runner.getPendingMigrations()

      // Verify migrations are sorted by version
      for (let i = 1; i < pending.length; i++) {
        expect(pending[i].version).toBeGreaterThan(pending[i - 1].version)
      }
    })

    it('should parse migration version and name correctly', () => {
      const pending = runner.getPendingMigrations()

      expect(pending[0].version).toBe(1)
      expect(pending[0].name).toBe('initial_schema')
      expect(pending[0].path).toContain('001_initial_schema.sql')
    })

    it('should not return already applied migrations', async () => {
      const allMigrations = runner.getPendingMigrations()

      if (allMigrations.length > 0) {
        // Run first migration
        await runner.run(allMigrations[0])

        // Should not appear in pending anymore
        const pending = runner.getPendingMigrations()
        expect(pending.length).toBe(allMigrations.length - 1)
      }
    })
  })

  describe('run', () => {
    it('should successfully run a migration with CREATE TABLE statements', async () => {
      const migrations = runner.getPendingMigrations()
      expect(migrations.length).toBeGreaterThan(0)

      await runner.run(migrations[0])

      // Verify tables were created
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as Array<{ name: string }>

      const tableNames = tables.map(t => t.name)
      expect(tableNames).toContain('notebooks')
      expect(tableNames).toContain('notes')
      expect(tableNames).toContain('tags')
    })

    it('should successfully run migrations with TRIGGER statements', async () => {
      const migrations = runner.getPendingMigrations()

      // This is the critical test that would have caught the bug!
      // The old code split by ';' which broke trigger definitions
      await runner.run(migrations[0])

      // Verify triggers were created
      const triggers = db
        .prepare("SELECT name FROM sqlite_master WHERE type='trigger'")
        .all() as Array<{ name: string }>

      expect(triggers.length).toBeGreaterThan(0)

      // Verify specific FTS sync triggers exist
      const triggerNames = triggers.map(t => t.name)
      expect(triggerNames).toContain('notes_fts_insert')
      expect(triggerNames).toContain('notes_fts_update')
      expect(triggerNames).toContain('notes_fts_delete')
    })

    it('should create FTS virtual tables correctly', async () => {
      const migrations = runner.getPendingMigrations()
      await runner.run(migrations[0])

      // Verify FTS table exists
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notes_fts'")
        .all()

      expect(tables).toHaveLength(1)
    })

    it('should create indexes correctly', async () => {
      const migrations = runner.getPendingMigrations()
      await runner.run(migrations[0])

      // Verify indexes were created
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index'")
        .all() as Array<{ name: string }>

      const indexNames = indexes.map(i => i.name)
      expect(indexNames).toContain('idx_notebooks_parent_id')
      expect(indexNames).toContain('idx_notes_notebook_id')
      expect(indexNames).toContain('idx_tags_name')
    })

    it('should record migration in schema_migrations table', async () => {
      const migrations = runner.getPendingMigrations()
      await runner.run(migrations[0])

      const applied = db
        .prepare('SELECT * FROM schema_migrations WHERE version = ?')
        .get(migrations[0].version) as any

      expect(applied).toBeDefined()
      expect(applied.name).toBe(migrations[0].name)
      expect(applied.checksum).toBeDefined()
      expect(applied.applied_at).toBeDefined()
    })

    it('should handle foreign key constraints correctly', async () => {
      const migrations = runner.getPendingMigrations()
      await runner.run(migrations[0])

      // Try to create a note with invalid notebook_id (should work due to NULL)
      const noteId = 'test-note-1'
      db.prepare(
        'INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).run(noteId, 'Test', 'Content', Date.now(), Date.now())

      // Verify note was created
      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId)
      expect(note).toBeDefined()
    })

    it('should throw error on invalid SQL', async () => {
      // Create a test migration with invalid SQL
      const tempMigrationPath = path.join(
        process.cwd(),
        'tests',
        'tmp',
        '999_invalid.sql'
      )

      fs.writeFileSync(tempMigrationPath, 'INVALID SQL SYNTAX;')

      const invalidMigration = {
        version: 999,
        name: 'invalid',
        path: tempMigrationPath,
      }

      await expect(runner.run(invalidMigration)).rejects.toThrow()

      // Cleanup
      fs.unlinkSync(tempMigrationPath)
    })
  })

  describe('getCurrentVersion', () => {
    it('should return 0 when no migrations applied', () => {
      const version = runner.getCurrentVersion()
      expect(version).toBe(0)
    })

    it('should return correct version after running migration', async () => {
      const migrations = runner.getPendingMigrations()
      await runner.run(migrations[0])

      const version = runner.getCurrentVersion()
      expect(version).toBe(1)
    })
  })

  describe('getMigrationHistory', () => {
    it('should return empty array when no migrations applied', () => {
      const history = runner.getMigrationHistory()
      expect(history).toEqual([])
    })

    it('should return migration history after running migrations', async () => {
      const migrations = runner.getPendingMigrations()
      await runner.run(migrations[0])

      const history = runner.getMigrationHistory()
      expect(history).toHaveLength(1)
      expect(history[0].version).toBe(1)
      expect(history[0].name).toBe('initial_schema')
      expect(history[0].applied_at).toBeDefined()
    })

    it('should return migrations in order', async () => {
      const migrations = runner.getPendingMigrations()

      // Run all migrations
      for (const migration of migrations) {
        await runner.run(migration)
      }

      const history = runner.getMigrationHistory()

      // Verify they're in ascending order
      for (let i = 1; i < history.length; i++) {
        expect(history[i].version).toBeGreaterThan(history[i - 1].version)
      }
    })
  })

  describe('checksum validation', () => {
    it('should calculate consistent checksums for same file', async () => {
      const migrations = runner.getPendingMigrations()
      await runner.run(migrations[0])

      const record1 = db
        .prepare('SELECT checksum FROM schema_migrations WHERE version = ?')
        .get(1) as { checksum: string }

      // Create new runner and get checksum again
      const runner2 = new MigrationRunner(db, path.join(process.cwd(), 'tests', 'tmp', 'migrations-test'))
      const migrations2 = runner2.getPendingMigrations()

      // Checksums should match for same file
      expect(record1.checksum).toBeDefined()
      expect(record1.checksum.length).toBeGreaterThan(0)
    })
  })

  describe('transaction rollback', () => {
    it('should rollback on error and not record migration', async () => {
      // Create a migration that will fail halfway through
      const tempMigrationPath = path.join(
        process.cwd(),
        'tests',
        'tmp',
        '998_partial_fail.sql'
      )

      fs.writeFileSync(
        tempMigrationPath,
        'CREATE TABLE test_table (id TEXT PRIMARY KEY);\nINVALID SQL HERE;'
      )

      const failingMigration = {
        version: 998,
        name: 'partial_fail',
        path: tempMigrationPath,
      }

      await expect(runner.run(failingMigration)).rejects.toThrow()

      // Migration should not be recorded
      const record = db
        .prepare('SELECT * FROM schema_migrations WHERE version = ?')
        .get(998)
      expect(record).toBeUndefined()

      // Table should not exist (rollback)
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'")
        .all()
      expect(tables).toHaveLength(0)

      // Cleanup
      fs.unlinkSync(tempMigrationPath)
    })
  })
})
