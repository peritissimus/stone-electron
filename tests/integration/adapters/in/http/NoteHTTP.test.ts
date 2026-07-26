import Fastify from 'fastify';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { NoteHTTP } from '../../../../../src/main/adapters/in/http/NoteHTTP';
import type { INoteUseCases, NoteProps } from '../../../../../src/main/domain';

const note: NoteProps = {
  id: 'note-1',
  title: 'A web note',
  filePath: 'Notes/note-1.md',
  notebookId: null,
  workspaceId: 'workspace-1',
  isFavorite: false,
  isPinned: false,
  isArchived: false,
  isDeleted: false,
  deletedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

function createApp() {
  const service = {
    listNotes: {
      execute: () => Effect.succeed({ notes: [note], total: 1 }),
    },
    getNote: {
      execute: () => Effect.succeed({ note, content: 'Hello from Markdown' }),
    },
    getNoteContent: {
      execute: () => Effect.succeed({ content: 'Hello from Markdown' }),
    },
    createNote: {
      execute: () => Effect.succeed({ note }),
    },
    updateNote: {
      execute: () => Effect.succeed({ note }),
    },
    deleteNote: {
      execute: () => Effect.void,
    },
    searchNotes: {
      execute: () => Effect.succeed({ notes: [note], total: 1 }),
    },
    toggleFavorite: {
      execute: () => Effect.succeed({ note: { ...note, isFavorite: true } }),
    },
  } as unknown as INoteUseCases;
  const app = Fastify({ logger: false });
  new NoteHTTP({
    runNoteEffect: (use) => Effect.runPromise(use(service)),
  }).register(app);
  return app;
}

describe('NoteHTTP', () => {
  it('lists notes through the inbound use-case port', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/notes?limit=20',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      total: 1,
      notes: [
        {
          id: 'note-1',
          title: 'A web note',
          embedding: null,
        },
      ],
    });
    await app.close();
  });

  it('returns note content from the HTTP representation', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/notes/note-1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      note: { id: 'note-1', embedding: null },
      content: 'Hello from Markdown',
    });
    await app.close();
  });

  it('rejects an invalid list limit at the boundary', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/notes?limit=not-a-number',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
    await app.close();
  });

  it('returns renderer-compatible full-text search results', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/search?query=web&limit=10',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      results: [
        {
          id: 'note-1',
          title: 'A web note',
          notebookId: null,
          score: 1,
          search_type: 'fts',
        },
      ],
      total: 1,
      query_time_ms: 0,
    });
    await app.close();
  });

  it('toggles a note flag through the use-case port', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/notes/note-1/favorite',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: 'note-1',
      isFavorite: true,
      embedding: null,
    });
    await app.close();
  });
});
