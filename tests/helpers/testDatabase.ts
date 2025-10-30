/**
 * Test Database Helpers
 */

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { nanoid } from 'nanoid'

/**
 * Create a test database with the schema
 */
export function createTestDatabase(): Database.Database {
  const testDbPath = path.join(
    process.cwd(),
    'tests',
    'tmp',
    `test-${nanoid()}.db`
  )

  const db = new Database(testDbPath)
  db.pragma('foreign_keys = ON')

  // Create schema
  db.exec(`
    -- Notebooks table
    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '📓',
      color TEXT DEFAULT '#3B82F6',
      parent_id TEXT,
      position INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (parent_id) REFERENCES notebooks(id) ON DELETE CASCADE
    );

    -- Notes table
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Untitled',
      content TEXT NOT NULL DEFAULT '',
      notebook_id TEXT,
      is_favorite INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      deleted_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE SET NULL
    );

    -- Tags table
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#3B82F6',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    -- Note tags junction table
    CREATE TABLE IF NOT EXISTS note_tags (
      note_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (note_id, tag_id),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    -- Attachments table
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    -- Note versions table
    CREATE TABLE IF NOT EXISTS note_versions (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    -- Settings table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    -- Schema migrations table
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      checksum TEXT NOT NULL
    );

    -- Full-text search virtual table
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      title,
      content,
      content=notes,
      content_rowid=rowid
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_notes_notebook_id ON notes(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_notes_is_favorite ON notes(is_favorite);
    CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON notes(is_pinned);
    CREATE INDEX IF NOT EXISTS idx_notes_is_archived ON notes(is_archived);
    CREATE INDEX IF NOT EXISTS idx_notes_is_deleted ON notes(is_deleted);
    CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at);
    CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
    CREATE INDEX IF NOT EXISTS idx_notebooks_parent_id ON notebooks(parent_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_note_id ON attachments(note_id);
  `)

  return db
}

/**
 * Clean up test database
 */
export function cleanupTestDatabase(db: Database.Database): void {
  const dbPath = db.name
  db.close()
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath)
  }
}
