import Fastify from 'fastify';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { LibraryHTTP } from '../../../../../src/main/adapters/in/http/LibraryHTTP';
import type {
  INotebookUseCases,
  IQuickNoteUseCases,
  ITagUseCases,
  ITaskUseCases,
} from '../../../../../src/main/domain';

const now = new Date('2026-01-01T00:00:00.000Z');
const notebook = {
  id: 'notebook-1',
  name: 'Web notebook',
  parentId: null,
  workspaceId: 'workspace-1',
  folderPath: null,
  icon: null,
  color: null,
  position: 0,
  createdAt: now,
  updatedAt: now,
};
const tag = {
  id: 'tag-1',
  name: 'browser',
  color: null,
  createdAt: now,
  updatedAt: now,
};

function createApp() {
  const notebooks = {
    listNotebooks: {
      execute: () => Effect.succeed({ notebooks: [{ ...notebook, noteCount: 2 }] }),
    },
    createNotebook: {
      execute: () => Effect.succeed({ notebook }),
    },
  } as unknown as INotebookUseCases;
  const tags = {
    listTags: {
      execute: () => Effect.succeed({ tags: [{ ...tag, noteCount: 1 }] }),
    },
    createTag: {
      execute: () => Effect.succeed({ tag }),
    },
    addTagToNote: {
      execute: () => Effect.void,
    },
  } as unknown as ITagUseCases;
  const tasks = {
    getAllTasks: {
      execute: () =>
        Effect.succeed([
          {
            id: 'note-1-0',
            noteId: 'note-1',
            noteTitle: 'Tasks',
            notePath: 'Tasks.md',
            text: 'Ship web app',
            state: 'todo' as const,
            checked: false,
            lineNumber: 1,
            createdAt: now,
            updatedAt: now,
          },
        ]),
    },
  } as unknown as ITaskUseCases;
  const quickNotes = {
    createInSlot: () => Effect.succeed({ noteId: 'quick-note-1' }),
  } as unknown as IQuickNoteUseCases;
  const app = Fastify({ logger: false });
  new LibraryHTTP({
    workspaceId: 'workspace-1',
    runNotebookEffect: (use) => Effect.runPromise(use(notebooks)),
    runTagEffect: (use) => Effect.runPromise(use(tags)),
    runTaskEffect: (use) => Effect.runPromise(use(tasks)),
    runQuickNoteEffect: (use) => Effect.runPromise(use(quickNotes)),
  }).register(app);
  return app;
}

describe('LibraryHTTP', () => {
  it('lists notebooks with renderer-compatible note counts', async () => {
    const app = createApp();
    const response = await app.inject({ method: 'GET', url: '/api/notebooks' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      notebooks: [{ id: 'notebook-1', note_count: 2 }],
    });
    await app.close();
  });

  it('creates and lists persistent tags through inbound ports', async () => {
    const app = createApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/tags',
      payload: { name: 'browser' },
    });
    const listed = await app.inject({ method: 'GET', url: '/api/tags' });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ id: 'tag-1', name: 'browser' });
    expect(listed.json()).toMatchObject({
      tags: [{ id: 'tag-1', note_count: 1 }],
    });
    await app.close();
  });

  it('adds tags to notes and returns refreshed counts', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/notes/note-1/tags',
      payload: { tagIds: ['tag-1'] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      tags: [{ id: 'tag-1', note_count: 1 }],
    });
    await app.close();
  });

  it('serializes server-backed tasks for the existing Tasks view', async () => {
    const app = createApp();
    const response = await app.inject({ method: 'GET', url: '/api/tasks' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject([
      {
        id: 'note-1-0',
        text: 'Ship web app',
        state: 'todo',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await app.close();
  });
});
