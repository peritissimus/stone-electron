import Fastify from 'fastify';
import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceHTTP } from '../../../../../src/main/adapters/in/http/WorkspaceHTTP';
import type { IWorkspaceUseCases, WorkspaceProps } from '../../../../../src/main/domain';

const workspace: WorkspaceProps = {
  id: 'workspace-1',
  name: 'Stone',
  folderPath: '/var/lib/stone/workspace',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  lastAccessedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const createFolder = vi.fn(() => Effect.succeed({ path: 'Work/Notes' }));
const renameFolder = vi.fn(() => Effect.succeed({ oldPath: 'Work', newPath: 'Archive' }));
const moveFolder = vi.fn(() => Effect.succeed({ oldPath: 'Work', newPath: 'Personal/Work' }));
const deleteFolder = vi.fn(() => Effect.void);

function createApp() {
  const service = {
    createFolder: { execute: createFolder },
    renameFolder: { execute: renameFolder },
    moveFolder: { execute: moveFolder },
    deleteFolder: { execute: deleteFolder },
  } as unknown as IWorkspaceUseCases;
  const app = Fastify({ logger: false });
  new WorkspaceHTTP({
    workspace,
    runWorkspaceEffect: (use) => Effect.runPromise(use(service)),
  }).register(app);
  return app;
}

describe('WorkspaceHTTP', () => {
  it('exposes the server-configured workspace', async () => {
    const app = createApp();
    const response = await app.inject({ method: 'GET', url: '/api/workspace' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: 'workspace-1',
      name: 'Stone',
      folderPath: '/var/lib/stone/workspace',
      isActive: true,
    });
    await app.close();
  });

  it('resolves the folder picker to the configured workspace instead of a native dialog', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/workspace/actions/select-folder',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      canceled: false,
      folderPath: '/var/lib/stone/workspace',
    });
    await app.close();
  });

  it('accepts the configured path, including a non-normalized form', async () => {
    const app = createApp();

    for (const candidate of [
      '/var/lib/stone/workspace',
      '/var/lib/stone/workspace/',
      '/var/lib/stone/./workspace',
      '/var/lib/stone/other/../workspace',
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/workspace/actions/validate-path',
        payload: { folderPath: candidate },
      });

      expect(response.statusCode, candidate).toBe(200);
      expect(response.json(), candidate).toEqual({ valid: true });
    }

    await app.close();
  });

  it('accepts the legacy `path` payload key', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/workspace/actions/validate-path',
      payload: { path: '/var/lib/stone/workspace' },
    });

    expect(response.json()).toEqual({ valid: true });
    await app.close();
  });

  it('rejects arbitrary server paths', async () => {
    const app = createApp();

    for (const candidate of ['/etc', '/var/lib/stone', '/var/lib/stone/workspace-other', '']) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/workspace/actions/validate-path',
        payload: { folderPath: candidate },
      });

      expect(response.statusCode, candidate).toBe(200);
      expect(response.json(), candidate).toMatchObject({ valid: false });
      expect(response.json().message, candidate).toBeTruthy();
    }

    await app.close();
  });

  it('creates a folder and returns the path under the folderPath key', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/workspace/folders',
      payload: { name: 'Notes', parentPath: 'Work' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ folderPath: 'Work/Notes' });
    expect(createFolder).toHaveBeenCalledWith({ name: 'Notes', parentPath: 'Work' });
    await app.close();
  });

  it('renames and moves folders, reporting the new path', async () => {
    const app = createApp();

    const renamed = await app.inject({
      method: 'PATCH',
      url: '/api/workspace/folders',
      payload: { path: 'Work', name: 'Archive' },
    });
    expect(renamed.json()).toEqual({ folderPath: 'Archive' });

    const moved = await app.inject({
      method: 'POST',
      url: '/api/workspace/folders/actions/move',
      payload: { sourcePath: 'Work', destinationPath: 'Personal' },
    });
    expect(moved.json()).toEqual({ folderPath: 'Personal/Work' });
    await app.close();
  });

  it('treats a move with no destination as a move to the workspace root', async () => {
    const app = createApp();
    await app.inject({
      method: 'POST',
      url: '/api/workspace/folders/actions/move',
      payload: { sourcePath: 'Work' },
    });

    expect(moveFolder).toHaveBeenCalledWith({ sourcePath: 'Work', destinationPath: null });
    await app.close();
  });

  it('deletes a folder addressed by query string', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/workspace/folders?path=Work%2FOld',
    });

    expect(response.json()).toEqual({ success: true });
    expect(deleteFolder).toHaveBeenCalledWith({ path: 'Work/Old' });
    await app.close();
  });

  it('rejects folder mutations that are missing required fields', async () => {
    const app = createApp();

    const created = await app.inject({
      method: 'POST',
      url: '/api/workspace/folders',
      payload: {},
    });
    expect(created.statusCode).toBe(400);

    const renamed = await app.inject({
      method: 'PATCH',
      url: '/api/workspace/folders',
      payload: { path: 'Work' },
    });
    expect(renamed.statusCode).toBe(400);

    const deleted = await app.inject({ method: 'DELETE', url: '/api/workspace/folders' });
    expect(deleted.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a request with no path at all', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/workspace/actions/validate-path',
      payload: {},
    });

    expect(response.json()).toMatchObject({ valid: false });
    await app.close();
  });
});
