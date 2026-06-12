import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FileWatcher,
  type WorkspaceSyncTrigger,
} from '../../../../../src/main/adapters/out/integrations/FileWatcher';
import { DOMAIN_EVENT_TYPES } from '../../../../../src/main/domain/ports/out/IEventPublisher';
import type { IEventPublisher, IWorkspaceRepository, WorkspaceProps } from '../../../../../src/main/domain';

const chokidarMock = vi.hoisted(() => {
  const callbacks = new Map<string, (...args: any[]) => void>();
  const watcher: { on: any; close: any } = {
    on: vi.fn((event: string, callback: (...args: any[]) => void): typeof watcher => {
      callbacks.set(event, callback);
      return watcher;
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    callbacks,
    watch: vi.fn(() => watcher),
    watcher,
  };
});

vi.mock('chokidar', () => ({
  default: { watch: chokidarMock.watch },
  watch: chokidarMock.watch,
}));

function workspace(overrides: Partial<WorkspaceProps> = {}): WorkspaceProps {
  return {
    id: 'ws-1',
    name: 'Workspace',
    folderPath: '/workspace',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    lastAccessedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  };
}

describe('FileWatcher', () => {
  let repository: IWorkspaceRepository;
  let publisher: IEventPublisher;
  let syncWorkspace: WorkspaceSyncTrigger;
  let syncWorkspaceSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    chokidarMock.callbacks.clear();

    repository = {
      findAll: vi.fn().mockResolvedValue([workspace()]),
      findById: vi.fn().mockResolvedValue(workspace()),
    } as unknown as IWorkspaceRepository;
    publisher = { publish: vi.fn() } as unknown as IEventPublisher;
    syncWorkspaceSpy = vi.fn().mockResolvedValue(undefined);
    syncWorkspace = syncWorkspaceSpy as unknown as WorkspaceSyncTrigger;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts watchers for known workspaces and ignores duplicate/invalid watches', async () => {
    const watcher = new FileWatcher({
      workspaceRepository: repository,
      eventPublisher: publisher,
      syncWorkspace,
    });

    await watcher.start();
    await watcher.start();
    await watcher.watchWorkspace(workspace());
    await watcher.watchWorkspace(workspace({ id: '', folderPath: '' }));

    expect(repository.findAll).toHaveBeenCalledTimes(1);
    expect(chokidarMock.watch).toHaveBeenCalledTimes(1);
    expect(chokidarMock.watch).toHaveBeenCalledWith(
      '/workspace',
      expect.objectContaining({ ignoreInitial: true, persistent: true }),
    );
  });

  it('publishes markdown file events and debounces structural syncs', async () => {
    const watcher = new FileWatcher({
      workspaceRepository: repository,
      eventPublisher: publisher,
      syncWorkspace,
    });

    await watcher.watchWorkspace(workspace());
    chokidarMock.callbacks.get('change')?.('/workspace/note.md');
    chokidarMock.callbacks.get('add')?.('/workspace/folder/new.md');
    chokidarMock.callbacks.get('unlink')?.('/workspace/ignored.txt');

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: DOMAIN_EVENT_TYPES.FILE_SYNCED,
        payload: { filePath: 'note.md', operation: 'updated' },
      }),
    );
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: DOMAIN_EVENT_TYPES.FILE_SYNCED,
        payload: { filePath: 'folder/new.md', operation: 'created' },
      }),
    );

    await vi.advanceTimersByTimeAsync(500);

    expect(syncWorkspaceSpy).toHaveBeenCalledWith('ws-1');
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: DOMAIN_EVENT_TYPES.WORKSPACE_UPDATED,
        payload: { workspace: expect.objectContaining({ id: 'ws-1' }) },
      }),
    );
  });

  it('clears timers and closes watchers when unwatched or stopped', async () => {
    const watcher = new FileWatcher({
      workspaceRepository: repository,
      eventPublisher: publisher,
      syncWorkspace,
    });

    await watcher.watchWorkspace(workspace());
    chokidarMock.callbacks.get('add')?.('/workspace/new.md');
    await watcher.unwatchWorkspace('ws-1');
    await vi.advanceTimersByTimeAsync(500);

    expect(syncWorkspaceSpy).not.toHaveBeenCalled();
    expect(chokidarMock.watcher.close).toHaveBeenCalledTimes(1);

    await watcher.watchWorkspace(workspace({ id: 'ws-2' }));
    await watcher.stopAll();

    expect(chokidarMock.watcher.close).toHaveBeenCalledTimes(2);
  });
});
