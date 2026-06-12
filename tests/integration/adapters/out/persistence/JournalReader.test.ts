import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JournalReader } from '../../../../../src/main/adapters/out/persistence/JournalReader';
import { notes } from '../../../../../src/main/shared/database/schema';

async function createDatabase() {
  const client = createClient({ url: ':memory:' });
  const db = drizzle(client);
  await client.execute(`
    CREATE TABLE notes (
      id TEXT PRIMARY KEY,
      title TEXT DEFAULT 'Untitled',
      file_path TEXT,
      notebook_id TEXT,
      workspace_id TEXT,
      is_favorite INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      deleted_at INTEGER,
      embedding BLOB,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  return { db, client };
}

describe('JournalReader', () => {
  let db: ReturnType<typeof drizzle>;
  let client: Client;

  beforeEach(async () => {
    ({ db, client } = await createDatabase());
  });

  afterEach(() => {
    client.close();
  });

  it('finds journal notes in the requested date range and reads their file contents', async () => {
    const now = new Date();
    await db.insert(notes).values([
      {
        id: 'journal-1',
        title: '2026-04-20',
        filePath: 'Journal/2026-04-20.md',
        workspaceId: 'ws-1',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'journal-2',
        title: '2026-04-21',
        filePath: 'Journal/2026-04-21.md',
        workspaceId: 'ws-1',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'outside-range',
        title: '2026-04-01',
        filePath: 'Journal/2026-04-01.md',
        workspaceId: 'ws-1',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'wrong-name',
        title: 'Ideas',
        filePath: 'Journal/Ideas.md',
        workspaceId: 'ws-1',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'deleted',
        title: '2026-04-21 deleted',
        filePath: 'Journal/2026-04-21.md',
        workspaceId: 'ws-1',
        isDeleted: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const fileStorage = {
      read: vi.fn(async (filePath: string) => `content:${filePath}`),
    };
    const reader = new JournalReader({ db: db as any, fileStorage: fileStorage as any });

    const records = await reader.findRecent({
      workspaceId: 'ws-1',
      workspaceFolderPath: '/workspace',
      journalFolder: 'Journal',
      oldestDate: '2026-04-20',
      newestDate: '2026-04-21',
    });

    expect(records).toEqual([
      {
        date: '2026-04-20',
        noteId: 'journal-1',
        filePath: 'Journal/2026-04-20.md',
        content: 'content:/workspace/Journal/2026-04-20.md',
      },
      {
        date: '2026-04-21',
        noteId: 'journal-2',
        filePath: 'Journal/2026-04-21.md',
        content: 'content:/workspace/Journal/2026-04-21.md',
      },
    ]);
    expect(fileStorage.read).toHaveBeenCalledTimes(2);
  });
});
