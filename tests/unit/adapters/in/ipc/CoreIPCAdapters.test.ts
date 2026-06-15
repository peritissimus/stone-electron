import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NOTEBOOK_CHANNELS,
  SEARCH_CHANNELS,
  TAG_CHANNELS,
  WORKSPACE_CHANNELS,
} from '../../../../../src/shared/constants/ipcChannels';
import {
  registerNotebookHandlers,
  unregisterNotebookHandlers,
} from '../../../../../src/main/adapters/in/ipc/NotebookIPC';
import {
  registerSearchHandlers,
  unregisterSearchHandlers,
} from '../../../../../src/main/adapters/in/ipc/SearchIPC';
import {
  registerTagHandlers,
  unregisterTagHandlers,
} from '../../../../../src/main/adapters/in/ipc/TagIPC';
import {
  registerWorkspaceHandlers,
  unregisterWorkspaceHandlers,
} from '../../../../../src/main/adapters/in/ipc/WorkspaceIPC';

const electronMock = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  const ipcMain = {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, handler);
    }),
    removeHandler: vi.fn(),
  };
  return { handlers, ipcMain };
});

vi.mock('electron', () => ({
  ipcMain: electronMock.ipcMain,
}));

const execute = (value: unknown = {}) => ({ execute: vi.fn().mockResolvedValue(value) });
const date = new Date('2026-04-21T10:00:00Z');

async function invoke(channel: string, request?: unknown) {
  const handler = electronMock.handlers.get(channel);
  expect(handler, `handler for ${channel}`).toBeDefined();
  return handler!({}, request);
}

function expectRegistered(channels: readonly string[]) {
  for (const channel of channels) {
    expect(electronMock.ipcMain.handle).toHaveBeenCalledWith(channel, expect.any(Function));
  }
}

function expectUnregistered(channels: readonly string[]) {
  for (const channel of channels) {
    expect(electronMock.ipcMain.removeHandler).toHaveBeenCalledWith(channel);
  }
}

describe('note/notebook/workspace/tag/search IPC adapters', () => {
  beforeEach(() => {
    electronMock.handlers.clear();
    vi.clearAllMocks();
  });

  it('SearchIPC registers, delegates all search channels, and unregisters', async () => {
    const searchUseCases = {
      fullTextSearch: execute({ results: [{ id: 'full' }] }),
      semanticSearch: execute({ results: [{ id: 'semantic' }] }),
      hybridSearch: execute({ results: [{ id: 'hybrid' }] }),
      searchByTags: execute({ results: [{ id: 'tagged' }] }),
      searchByDateRange: execute({ results: [{ id: 'dated' }] }),
      getRelatedNotes: execute({ notes: [{ id: 'related' }] }),
    };
    registerSearchHandlers({ searchUseCases } as any);

    expectRegistered(Object.values(SEARCH_CHANNELS));
    await expect(invoke(SEARCH_CHANNELS.FULL_TEXT, { query: 'stone', workspaceId: 'ws-1' })).resolves.toEqual({
      success: true,
      data: { results: [{ id: 'full' }] },
    });
    await invoke(SEARCH_CHANNELS.SEMANTIC, { query: 'stone', workspaceId: 'ws-1' });
    await invoke(SEARCH_CHANNELS.HYBRID, { query: 'stone', workspaceId: 'ws-1' });
    await invoke(SEARCH_CHANNELS.BY_TAG, { tags: ['ai'], workspaceId: 'ws-1' });
    await invoke(SEARCH_CHANNELS.BY_DATE_RANGE, {
      startDate: '2026-04-01',
      endDate: '2026-04-21',
      workspaceId: 'ws-1',
    });
    await invoke(SEARCH_CHANNELS.GET_RELATED, { noteId: 'note-1', limit: 5 });

    expect(searchUseCases.getRelatedNotes.execute).toHaveBeenCalledWith({
      noteId: 'note-1',
      limit: 5,
    });

    unregisterSearchHandlers();
    expectUnregistered(Object.values(SEARCH_CHANNELS));
  });

  it('NotebookIPC parses wire payloads into notebook use case requests', async () => {
    const notebook = {
      id: 'nb-1',
      name: 'Projects',
      parentId: null,
      workspaceId: 'ws-1',
      folderPath: '/tmp/Projects',
      icon: null,
      color: null,
      position: null,
      createdAt: date,
      updatedAt: date,
    };
    const notebookUseCases = {
      createNotebook: execute({ notebook }),
      updateNotebook: execute({ notebook: { ...notebook, name: 'Renamed' } }),
      deleteNotebook: execute(undefined),
      listNotebooks: execute({ notebooks: [{ ...notebook, note_count: 1 }] }),
      moveNotebook: execute(undefined),
    };
    registerNotebookHandlers({ notebookUseCases } as any);

    await expect(
      invoke(NOTEBOOK_CHANNELS.CREATE, {
        name: 'Projects',
        parent_id: 'parent-1',
        icon: 'folder',
        color: '#ffffff',
      }),
    ).resolves.toEqual({ success: true, data: notebook });
    await invoke(NOTEBOOK_CHANNELS.UPDATE, { id: 'nb-1', name: 'Renamed' });
    await invoke(NOTEBOOK_CHANNELS.DELETE, { id: 'nb-1', delete_notes: true });
    await expect(invoke(NOTEBOOK_CHANNELS.GET_ALL, { include_counts: true })).resolves.toMatchObject({
      success: true,
      data: { notebooks: [{ id: 'nb-1', note_count: 1 }] },
    });
    await invoke(NOTEBOOK_CHANNELS.MOVE, { id: 'nb-1', parent_id: 'parent-2' });

    expect(notebookUseCases.createNotebook.execute).toHaveBeenCalledWith({
      name: 'Projects',
      parentId: 'parent-1',
      icon: 'folder',
      color: '#ffffff',
    });
    expect(notebookUseCases.deleteNotebook.execute).toHaveBeenCalledWith({
      id: 'nb-1',
      deleteNotes: true,
    });
    expect(notebookUseCases.moveNotebook.execute).toHaveBeenCalledWith({
      id: 'nb-1',
      targetParentId: 'parent-2',
    });

    unregisterNotebookHandlers();
    expectUnregistered(Object.values(NOTEBOOK_CHANNELS));
  });

  it('TagIPC parses tag payloads and handles multi-tag add requests', async () => {
    const tag = {
      id: 'tag-1',
      name: 'AI',
      color: '#ffffff',
      createdAt: date,
      updatedAt: date,
      note_count: 1,
    };
    const tagUseCases = {
      createTag: execute({ tag }),
      deleteTag: execute(undefined),
      listTags: execute({ tags: [tag] }),
      addTagToNote: execute(undefined),
      removeTagFromNote: execute(undefined),
    };
    registerTagHandlers({ tagUseCases } as any);

    await expect(invoke(TAG_CHANNELS.CREATE, { name: 'AI', color: '#ffffff' })).resolves.toEqual({
      success: true,
      data: tag,
    });
    await invoke(TAG_CHANNELS.DELETE, { id: 'tag-1' });
    await expect(invoke(TAG_CHANNELS.GET_ALL, { sort: 'name' })).resolves.toEqual({
      success: true,
      data: { tags: [tag] },
    });
    await invoke(TAG_CHANNELS.ADD_TO_NOTE, { noteId: 'note-1', tagIds: ['tag-1', 'tag-2'] });
    await invoke(TAG_CHANNELS.REMOVE_FROM_NOTE, { noteId: 'note-1', tagId: 'tag-1' });

    expect(tagUseCases.addTagToNote.execute).toHaveBeenCalledTimes(2);
    expect(tagUseCases.addTagToNote.execute).toHaveBeenNthCalledWith(1, {
      noteId: 'note-1',
      tagId: 'tag-1',
    });
    expect(tagUseCases.addTagToNote.execute).toHaveBeenNthCalledWith(2, {
      noteId: 'note-1',
      tagId: 'tag-2',
    });

    unregisterTagHandlers();
    expectUnregistered(Object.values(TAG_CHANNELS));
  });

  it('WorkspaceIPC maps workspace and folder requests to workspace use cases', async () => {
    const workspace = {
      id: 'ws-1',
      name: 'Stone',
      folderPath: '/tmp/stone',
      isActive: true,
      createdAt: date,
      lastAccessedAt: date,
    };
    const syncResponse = {
      workspaceId: 'ws-1',
      notebooks: { created: 1, updated: 0, errors: [] },
      notes: { created: 1, updated: 2, deleted: 0, embedded: 1, errors: [] },
    };
    const workspaceUseCases = {
      createWorkspace: execute({ workspace }),
      listWorkspaces: execute({ workspaces: [workspace] }),
      deleteWorkspace: execute(undefined),
      setActiveWorkspace: execute({ workspace }),
      getActiveWorkspace: execute({ workspace }),
      updateWorkspace: execute({ workspace: { ...workspace, name: 'Renamed' } }),
      selectFolder: execute({ folderPath: '/tmp/stone' }),
      getDefaultWorkspacePath: execute({ path: '/tmp/default' }),
      validatePath: execute({ valid: false, error: 'Already used' }),
      createFolder: execute({ path: '/tmp/stone/Inbox' }),
      renameFolder: execute({ newPath: '/tmp/stone/Renamed' }),
      deleteFolder: execute(undefined),
      moveFolder: execute({ newPath: '/tmp/stone/Archive/Inbox' }),
      scanWorkspace: execute({ files: [], structure: [], total: 0 }),
      syncWorkspace: execute(syncResponse),
    };
    registerWorkspaceHandlers({ workspaceUseCases } as any);

    expectRegistered(Object.values(WORKSPACE_CHANNELS));
    await expect(invoke(WORKSPACE_CHANNELS.CREATE, { name: 'Stone', path: '/tmp/stone' })).resolves.toEqual({
      success: true,
      data: workspace,
    });
    await expect(invoke(WORKSPACE_CHANNELS.GET_ALL)).resolves.toEqual({
      success: true,
      data: { workspaces: [workspace] },
    });
    await invoke(WORKSPACE_CHANNELS.DELETE, { id: 'ws-1' });
    await invoke(WORKSPACE_CHANNELS.SET_ACTIVE, { id: 'ws-1' });
    await invoke(WORKSPACE_CHANNELS.GET_ACTIVE);
    await invoke(WORKSPACE_CHANNELS.UPDATE, { id: 'ws-1', name: 'Renamed' });
    await invoke(WORKSPACE_CHANNELS.SELECT_FOLDER, { title: 'Pick' });
    await invoke(WORKSPACE_CHANNELS.GET_DEFAULT_PATH);
    await expect(invoke(WORKSPACE_CHANNELS.VALIDATE_PATH, { folderPath: '/tmp/stone' })).resolves.toEqual({
      success: true,
      data: { valid: false, message: 'Already used' },
    });
    await invoke(WORKSPACE_CHANNELS.CREATE_FOLDER, { parentPath: '/tmp/stone', name: 'Inbox' });
    await invoke(WORKSPACE_CHANNELS.RENAME_FOLDER, { path: '/tmp/stone/Inbox', name: 'Renamed' });
    await invoke(WORKSPACE_CHANNELS.DELETE_FOLDER, { path: '/tmp/stone/Inbox' });
    await invoke(WORKSPACE_CHANNELS.MOVE_FOLDER, {
      sourcePath: '/tmp/stone/Inbox',
      destinationPath: '/tmp/stone/Archive',
    });
    await invoke(WORKSPACE_CHANNELS.SCAN, { workspaceId: 'ws-1' });
    await expect(invoke(WORKSPACE_CHANNELS.SYNC, { workspaceId: 'ws-1' })).resolves.toEqual({
      success: true,
      data: syncResponse,
    });

    expect(workspaceUseCases.createWorkspace.execute).toHaveBeenCalledWith({
      name: 'Stone',
      folderPath: '/tmp/stone',
    });
    expect(workspaceUseCases.validatePath.execute).toHaveBeenCalledWith({
      folderPath: '/tmp/stone',
    });
    expect(workspaceUseCases.moveFolder.execute).toHaveBeenCalledWith({
      sourcePath: '/tmp/stone/Inbox',
      destinationPath: '/tmp/stone/Archive',
    });

    unregisterWorkspaceHandlers();
    expectUnregistered(Object.values(WORKSPACE_CHANNELS));
  });
});
