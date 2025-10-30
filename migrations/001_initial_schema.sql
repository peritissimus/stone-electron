-- Initial Schema Migration for Stone Notes App
-- Version: 001
-- Description: Creates all base tables for notes, notebooks, tags, and attachments

-- Notebooks Table
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

-- Notes Table
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT DEFAULT 'Untitled',
  content TEXT DEFAULT '',
  notebook_id TEXT DEFAULT NULL,
  is_favorite INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  is_archived INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_notebook_id ON notes(notebook_id);
CREATE INDEX IF NOT EXISTS idx_notes_favorite ON notes(is_favorite);
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned);
CREATE INDEX IF NOT EXISTS idx_notes_archived ON notes(is_archived);
CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(is_deleted);
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

-- Tags Table
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
