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

  // Create schema - matches migrations/001_initial_schema.sql
  db.exec(`
    -- Notebooks table
    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT DEFAULT NULL,
      icon TEXT DEFAULT '📁',
      color TEXT DEFAULT '#3b82f6',
      position INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES notebooks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_notebooks_parent_id ON notebooks(parent_id);
    CREATE INDEX IF NOT EXISTS idx_notebooks_position ON notebooks(position);

    -- Notes table
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT DEFAULT 'Untitled',
      content TEXT DEFAULT '',
      notebook_id TEXT DEFAULT NULL,
      is_favorite INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      deleted_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_notebook_id ON notes(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_notes_favorite ON notes(is_favorite);
    CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned);
    CREATE INDEX IF NOT EXISTS idx_notes_archived ON notes(is_archived);
    CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
    CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at);

    -- Full-text search virtual table
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      title,
      content,
      content=notes,
      content_rowid=rowid
    );

    -- Triggers to keep FTS in sync
    CREATE TRIGGER IF NOT EXISTS notes_fts_insert AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS notes_fts_delete AFTER DELETE ON notes BEGIN
      DELETE FROM notes_fts WHERE rowid = old.rowid;
    END;

    CREATE TRIGGER IF NOT EXISTS notes_fts_update AFTER UPDATE ON notes BEGIN
      DELETE FROM notes_fts WHERE rowid = old.rowid;
      INSERT INTO notes_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
    END;

    -- Tags table
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#6b7280',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

    -- Note Tags Junction Table
    CREATE TABLE IF NOT EXISTS note_tags (
      note_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (note_id, tag_id),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_note_tags_note_id ON note_tags(note_id);
    CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id);

    -- Attachments Table
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_attachments_note_id ON attachments(note_id);

    -- Note Versions Table (for version history)
    CREATE TABLE IF NOT EXISTS note_versions (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_note_versions_note_id ON note_versions(note_id);
    CREATE INDEX IF NOT EXISTS idx_note_versions_created_at ON note_versions(created_at);

    -- Note Links Table (for bidirectional links)
    CREATE TABLE IF NOT EXISTS note_links (
      source_note_id TEXT NOT NULL,
      target_note_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (source_note_id, target_note_id),
      FOREIGN KEY (source_note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (target_note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_note_links_source ON note_links(source_note_id);
    CREATE INDEX IF NOT EXISTS idx_note_links_target ON note_links(target_note_id);
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
