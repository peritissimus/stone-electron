import Fastify from 'fastify';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { KnowledgeHTTP } from '../../../../../src/main/adapters/in/http/KnowledgeHTTP';
import type {
  IGraphUseCases,
  IJournalUseCases,
  INoteUseCases,
  IVersionUseCases,
  NoteProps,
} from '../../../../../src/main/domain';

const now = new Date('2026-01-02T00:00:00.000Z');
const note: NoteProps = {
  id: 'note-1',
  title: 'Linked note',
  filePath: 'Notes/linked.md',
  notebookId: null,
  workspaceId: 'workspace-1',
  isFavorite: false,
  isPinned: false,
  isArchived: false,
  isDeleted: false,
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
};

function createApp() {
  const notes = {
    getNote: {
      execute: () => Effect.succeed({ note }),
    },
  } as unknown as INoteUseCases;
  const graph = {
    getGraphData: {
      execute: () =>
        Effect.succeed({
          nodes: [
            { id: 'note-1', label: 'Linked note', type: 'note' as const, metadata: { degree: 0 } },
          ],
          links: [],
        }),
    },
    getBacklinks: {
      execute: () =>
        Effect.succeed([
          {
            sourceId: 'note-1',
            sourceTitle: 'Linked note',
            targetId: 'note-2',
            targetTitle: 'Target',
            linkText: '',
          },
        ]),
    },
  } as unknown as IGraphUseCases;
  const versions = {
    getVersions: {
      execute: () =>
        Effect.succeed([
          {
            id: 'version-1',
            noteId: 'note-1',
            versionNumber: 1,
            content: 'Version content',
            title: 'Linked note',
            createdAt: now,
          },
        ]),
    },
  } as unknown as IVersionUseCases;
  const journals = {
    listRange: () =>
      Effect.succeed({
        entries: [
          {
            date: '2026-01-02',
            noteId: 'note-1',
            exists: true,
            content: 'Journal body',
          },
        ],
      }),
    openOrCreateForDate: () => Effect.succeed({ noteId: 'note-1', created: true }),
  } as unknown as IJournalUseCases;

  const app = Fastify({ logger: false });
  new KnowledgeHTTP({
    runNoteEffect: (use) => Effect.runPromise(use(notes)),
    runGraphEffect: (use) => Effect.runPromise(use(graph)),
    runVersionEffect: (use) => Effect.runPromise(use(versions)),
    runJournalEffect: (use) => Effect.runPromise(use(journals)),
  }).register(app);
  return app;
}

describe('KnowledgeHTTP', () => {
  it('returns graph data and hydrated backlink notes', async () => {
    const app = createApp();
    const graph = await app.inject({ method: 'GET', url: '/api/graph' });
    const backlinks = await app.inject({
      method: 'GET',
      url: '/api/notes/note-2/backlinks',
    });

    expect(graph.statusCode).toBe(200);
    expect(graph.json()).toMatchObject({
      nodes: [{ id: 'note-1', type: 'note' }],
    });
    expect(backlinks.json()).toMatchObject({
      notes: [{ id: 'note-1', embedding: null }],
    });
    await app.close();
  });

  it('serializes version summaries for the existing history panel', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/notes/note-1/versions',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      versions: [
        {
          id: 'version-1',
          noteId: 'note-1',
          versionNumber: 1,
          title: 'Linked note',
          contentPreview: 'Version content',
          createdAt: '2026-01-02T00:00:00.000Z',
          sizeBytes: 15,
        },
      ],
    });
    await app.close();
  });

  it('lists and creates journal entries', async () => {
    const app = createApp();
    const listed = await app.inject({
      method: 'GET',
      url: '/api/journals?limit=7',
    });
    const created = await app.inject({
      method: 'POST',
      url: '/api/journals',
      payload: { date: '2026-01-02' },
    });

    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({
      entries: [{ date: '2026-01-02', exists: true }],
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toEqual({ noteId: 'note-1', created: true });
    await app.close();
  });
});
