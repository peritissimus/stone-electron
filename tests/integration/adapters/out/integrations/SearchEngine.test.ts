import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchEngine } from '../../../../../src/main/adapters/out/integrations/SearchEngine';
import { noteTags, notes } from '../../../../../src/main/shared/database/schema';

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
  await client.execute(`
    CREATE TABLE note_tags (
      note_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (note_id, tag_id)
    )
  `);
  return { db, client };
}

describe('SearchEngine', () => {
  let db: ReturnType<typeof drizzle>;
  let client: Client;

  beforeEach(async () => {
    ({ db, client } = await createDatabase());
  });

  afterEach(() => {
    client.close();
  });

  it('searches note titles and date ranges while ignoring deleted or wrong-workspace rows', async () => {
    const oldDate = new Date('2026-04-01T10:00:00Z');
    const newDate = new Date('2026-04-21T10:00:00Z');
    await db.insert(notes).values([
      {
        id: 'note-1',
        title: 'Stone roadmap',
        filePath: 'roadmap.md',
        workspaceId: 'ws-1',
        isDeleted: false,
        createdAt: oldDate,
        updatedAt: newDate,
      },
      {
        id: 'note-2',
        title: 'Stone deleted',
        filePath: 'deleted.md',
        workspaceId: 'ws-1',
        isDeleted: true,
        createdAt: oldDate,
        updatedAt: newDate,
      },
      {
        id: 'note-3',
        title: 'Stone other workspace',
        filePath: 'other.md',
        workspaceId: 'ws-2',
        isDeleted: false,
        createdAt: oldDate,
        updatedAt: newDate,
      },
    ]);
    const engine = new SearchEngine({ db: db as any, noteRepository: {} as any });

    await expect(engine.searchFullText('   ')).resolves.toEqual([]);
    await expect(engine.searchFullText('Stone!!!', { workspaceId: 'ws-1' })).resolves.toMatchObject([
      {
        note: { id: 'note-1', title: 'Stone roadmap', workspaceId: 'ws-1' },
        relevance: 1,
        matchType: 'title',
      },
    ]);
    await expect(
      engine.searchByDateRange({
        workspaceId: 'ws-1',
        startDate: new Date('2026-04-20T00:00:00Z'),
        endDate: new Date('2026-04-22T00:00:00Z'),
        field: 'updated',
      }),
    ).resolves.toMatchObject([{ id: 'note-1', title: 'Stone roadmap' }]);
  });

  it('searches by any or all tags through the note repository and applies limits', async () => {
    const now = new Date('2026-04-21T10:00:00Z');
    await db.insert(noteTags).values([
      { noteId: 'note-1', tagId: 'tag-a', createdAt: now },
      { noteId: 'note-1', tagId: 'tag-b', createdAt: now },
      { noteId: 'note-2', tagId: 'tag-a', createdAt: now },
    ]);
    const noteRepository = {
      findById: vi.fn(async (id: string) => ({
        id,
        title: id,
        workspaceId: id === 'note-2' ? 'ws-2' : 'ws-1',
        isDeleted: false,
      })),
    };
    const engine = new SearchEngine({ db: db as any, noteRepository: noteRepository as any });

    await expect(engine.searchByTags([])).resolves.toEqual([]);
    await expect(engine.searchByTags(['tag-a'], { workspaceId: 'ws-1' })).resolves.toMatchObject([
      { id: 'note-1' },
    ]);
    await expect(
      engine.searchByTags(['tag-a', 'tag-b'], { workspaceId: 'ws-1', matchAll: true, limit: 1 }),
    ).resolves.toMatchObject([{ id: 'note-1' }]);
  });
});
