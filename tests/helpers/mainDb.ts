import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../../src/main/shared/database/schema';

export type TestDatabase = Awaited<ReturnType<typeof createMainTestDatabase>>;

export async function createMainTestDatabase() {
  const client = createClient({ url: ':memory:' });
  const db = drizzle(client, { schema });

  await client.execute('PRAGMA foreign_keys = ON');
  await createSchema(client);

  return {
    client,
    db,
    async close() {
      client.close();
    },
  };
}

async function createSchema(client: Client) {
  const statements = [
    `CREATE TABLE workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      folder_path TEXT NOT NULL UNIQUE,
      is_active INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      last_accessed_at INTEGER NOT NULL
    )`,
    `CREATE TABLE notebooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
      folder_path TEXT,
      icon TEXT DEFAULT 'folder',
      color TEXT DEFAULT '#3b82f6',
      position INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE notes (
      id TEXT PRIMARY KEY,
      title TEXT DEFAULT 'Untitled',
      file_path TEXT,
      notebook_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL,
      workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
      is_favorite INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      deleted_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE note_chunks (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      heading_path TEXT NOT NULL DEFAULT '[]',
      text TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      token_count INTEGER NOT NULL DEFAULT 0,
      embedding BLOB,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE VIRTUAL TABLE note_chunks_fts USING fts5(
      chunk_id UNINDEXED,
      note_id UNINDEXED,
      workspace_id UNINDEXED,
      title,
      heading_path,
      text
    )`,
    `CREATE TABLE note_index_records (
      note_id TEXT PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      content_hash TEXT NOT NULL,
      chunk_count INTEGER NOT NULL DEFAULT 0,
      indexed_at INTEGER,
      model TEXT,
      dimensions INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT
    )`,
    `CREATE TABLE tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#6b7280',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE note_tags (
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (note_id, tag_id)
    )`,
    `CREATE TABLE note_links (
      source_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      target_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (source_note_id, target_note_id)
    )`,
    `CREATE TABLE attachments (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      path TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE note_versions (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE topics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      color TEXT DEFAULT '#6366f1',
      is_predefined INTEGER DEFAULT 0,
      centroid BLOB,
      note_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE note_topics (
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      confidence REAL DEFAULT 1,
      is_manual INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (note_id, topic_id)
    )`,
    `CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE meeting_recordings (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'recording',
      audio_path TEXT,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      transcript_text TEXT,
      transcript_segments TEXT NOT NULL DEFAULT '[]',
      summary TEXT,
      prompt_used TEXT,
      journal_date TEXT,
      error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
  ];

  for (const statement of statements) {
    await client.execute(statement);
  }
}

export async function seedWorkspace(db: TestDatabase['db'], id = 'ws-1') {
  await db.insert(schema.workspaces).values({
    id,
    name: `Workspace ${id}`,
    folderPath: `/tmp/${id}`,
    isActive: id === 'ws-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    lastAccessedAt: new Date('2026-01-02T00:00:00.000Z'),
  });
}

export async function seedNote(db: TestDatabase['db'], id: string, workspaceId = 'ws-1') {
  await db.insert(schema.notes).values({
    id,
    title: `Note ${id}`,
    filePath: `${id}.md`,
    workspaceId,
    createdAt: new Date('2026-01-03T00:00:00.000Z'),
    updatedAt: new Date('2026-01-04T00:00:00.000Z'),
  });
}
