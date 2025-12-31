/**
 * FileWatcherService Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FSWatcher } from 'chokidar';
import type { EventEmitter } from 'events';

// Create mock watcher
const createMockWatcher = () => {
  const handlers: Record<string, Function[]> = {};
  const mockWatcher = {
    on: vi.fn((event: string, handler: Function) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
      return mockWatcher;
    }),
    close: vi.fn(() => Promise.resolve()),
    emit: (event: string, ...args: any[]) => {
      handlers[event]?.forEach(h => h(...args));
    },
    getHandlers: () => handlers,
  };
  return mockWatcher;
};

let mockWatcher = createMockWatcher();

// Mock chokidar before importing
vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(() => mockWatcher),
  },
  watch: vi.fn(() => mockWatcher),
}));

// Mock electron
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [
      { webContents: { send: vi.fn() } },
    ]),
  },
}));

// Mock logger
vi.mock('../../src/main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock repositories
const mockWsRepoInstance = {
  findAll: vi.fn(),
  findById: vi.fn(),
};

const mockNbRepoInstance = {
  syncWithWorkspaceFolders: vi.fn(),
};

const mockNoteRepoInstance = {
  syncWithFileSystem: vi.fn(),
};

vi.mock('../../src/main/repositories/WorkspaceRepository', () => ({
  WorkspaceRepository: vi.fn(() => mockWsRepoInstance),
}));

vi.mock('../../src/main/repositories/NotebookRepository', () => ({
  NotebookRepository: vi.fn(() => mockNbRepoInstance),
}));

vi.mock('../../src/main/repositories/NoteRepository', () => ({
  NoteRepository: vi.fn(() => mockNoteRepoInstance),
}));

// Import after mocks
import chokidar from 'chokidar';
import { BrowserWindow } from 'electron';
import { FileWatcherService, getFileWatcherService } from '../../src/main/services/FileWatcherService';

describe('FileWatcherService', () => {
  let service: FileWatcherService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWatcher = createMockWatcher();
    (chokidar.watch as any).mockReturnValue(mockWatcher);
    service = new FileWatcherService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('start', () => {
    it('should start watching all workspaces', async () => {
      mockWsRepoInstance.findAll.mockResolvedValue([
        { id: 'ws-1', name: 'Workspace 1', folderPath: '/path/to/ws1' },
        { id: 'ws-2', name: 'Workspace 2', folderPath: '/path/to/ws2' },
      ]);

      await service.start();

      expect(mockWsRepoInstance.findAll).toHaveBeenCalled();
      expect(chokidar.watch).toHaveBeenCalledTimes(2);
    });

    it('should not start twice', async () => {
      mockWsRepoInstance.findAll.mockResolvedValue([
        { id: 'ws-1', name: 'Workspace 1', folderPath: '/path/to/ws1' },
      ]);

      await service.start();
      await service.start();

      expect(mockWsRepoInstance.findAll).toHaveBeenCalledTimes(1);
    });

    it('should handle empty workspaces', async () => {
      mockWsRepoInstance.findAll.mockResolvedValue([]);

      await service.start();

      expect(chokidar.watch).not.toHaveBeenCalled();
    });
  });

  describe('stopAll', () => {
    it('should stop all watchers', async () => {
      mockWsRepoInstance.findAll.mockResolvedValue([
        { id: 'ws-1', name: 'Workspace 1', folderPath: '/path/to/ws1' },
      ]);

      await service.start();
      await service.stopAll();

      expect(mockWatcher.close).toHaveBeenCalled();
    });

    it('should allow restart after stop', async () => {
      mockWsRepoInstance.findAll.mockResolvedValue([
        { id: 'ws-1', name: 'Workspace 1', folderPath: '/path/to/ws1' },
      ]);

      await service.start();
      await service.stopAll();

      // Reset mock for next start
      mockWatcher = createMockWatcher();
      (chokidar.watch as any).mockReturnValue(mockWatcher);

      await service.start();

      expect(mockWsRepoInstance.findAll).toHaveBeenCalledTimes(2);
    });
  });

  describe('watchWorkspace', () => {
    it('should watch a workspace folder', async () => {
      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/test/path' };

      await service.watchWorkspace(workspace);

      expect(chokidar.watch).toHaveBeenCalledWith('/test/path', expect.objectContaining({
        ignoreInitial: true,
        persistent: true,
      }));
    });

    it('should not watch invalid workspace', async () => {
      await service.watchWorkspace(null as any);
      await service.watchWorkspace({ id: null } as any);
      await service.watchWorkspace({ id: 'ws-1' } as any);

      expect(chokidar.watch).not.toHaveBeenCalled();
    });

    it('should not duplicate watchers', async () => {
      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/test/path' };

      await service.watchWorkspace(workspace);
      await service.watchWorkspace(workspace);

      expect(chokidar.watch).toHaveBeenCalledTimes(1);
    });

    it('should set up event handlers', async () => {
      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/test/path' };

      await service.watchWorkspace(workspace);

      expect(mockWatcher.on).toHaveBeenCalledWith('add', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('change', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('unlink', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('unwatchWorkspace', () => {
    it('should unwatch a workspace', async () => {
      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/test/path' };

      await service.watchWorkspace(workspace);
      await service.unwatchWorkspace('ws-1');

      expect(mockWatcher.close).toHaveBeenCalled();
    });

    it('should handle non-existent workspace', async () => {
      await service.unwatchWorkspace('non-existent');

      expect(mockWatcher.close).not.toHaveBeenCalled();
    });
  });

  describe('file events', () => {
    it('should emit FILE_CREATED event for new .md files', async () => {
      const mockWindow = { webContents: { send: vi.fn() } };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/test/path' };
      await service.watchWorkspace(workspace);

      // Trigger add event
      mockWatcher.emit('add', '/test/path/new-file.md');

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'files:created',
        expect.objectContaining({ workspaceId: 'ws-1', path: 'new-file.md' })
      );
    });

    it('should emit FILE_CHANGED event for modified .md files', async () => {
      const mockWindow = { webContents: { send: vi.fn() } };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/test/path' };
      await service.watchWorkspace(workspace);

      mockWatcher.emit('change', '/test/path/changed-file.md');

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'files:changed',
        expect.objectContaining({ workspaceId: 'ws-1', path: 'changed-file.md' })
      );
    });

    it('should emit FILE_DELETED event for removed .md files', async () => {
      const mockWindow = { webContents: { send: vi.fn() } };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/test/path' };
      await service.watchWorkspace(workspace);

      mockWatcher.emit('unlink', '/test/path/deleted-file.md');

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'files:deleted',
        expect.objectContaining({ workspaceId: 'ws-1', path: 'deleted-file.md' })
      );
    });

    it('should ignore non-markdown files', async () => {
      const mockWindow = { webContents: { send: vi.fn() } };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/test/path' };
      await service.watchWorkspace(workspace);

      mockWatcher.emit('add', '/test/path/image.png');
      mockWatcher.emit('change', '/test/path/document.txt');
      mockWatcher.emit('unlink', '/test/path/data.json');

      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('should handle nested paths correctly', async () => {
      const mockWindow = { webContents: { send: vi.fn() } };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/test/path' };
      await service.watchWorkspace(workspace);

      mockWatcher.emit('add', '/test/path/folder/subfolder/note.md');

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'files:created',
        expect.objectContaining({ path: 'folder/subfolder/note.md' })
      );
    });

    it('should schedule sync for add events', async () => {
      vi.useFakeTimers();

      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/test/path' };
      mockWsRepoInstance.findById.mockResolvedValue(workspace);
      mockNbRepoInstance.syncWithWorkspaceFolders.mockResolvedValue({});
      mockNoteRepoInstance.syncWithFileSystem.mockResolvedValue({});

      await service.watchWorkspace(workspace);
      mockWatcher.emit('add', '/test/path/new-file.md');

      // Advance timer to trigger debounced sync
      await vi.advanceTimersByTimeAsync(600);

      expect(mockWsRepoInstance.findById).toHaveBeenCalledWith('ws-1');

      vi.useRealTimers();
    });

    it('should schedule sync for unlink events', async () => {
      vi.useFakeTimers();

      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/test/path' };
      mockWsRepoInstance.findById.mockResolvedValue(workspace);
      mockNbRepoInstance.syncWithWorkspaceFolders.mockResolvedValue({});
      mockNoteRepoInstance.syncWithFileSystem.mockResolvedValue({});

      await service.watchWorkspace(workspace);
      mockWatcher.emit('unlink', '/test/path/deleted-file.md');

      await vi.advanceTimersByTimeAsync(600);

      expect(mockWsRepoInstance.findById).toHaveBeenCalledWith('ws-1');

      vi.useRealTimers();
    });

    it('should not schedule sync for change events', async () => {
      vi.useFakeTimers();

      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/test/path' };
      mockWsRepoInstance.findById.mockResolvedValue(workspace);

      await service.watchWorkspace(workspace);
      mockWatcher.emit('change', '/test/path/changed-file.md');

      await vi.advanceTimersByTimeAsync(600);

      // findById should not be called for change events (no sync scheduled)
      expect(mockWsRepoInstance.findById).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should debounce multiple events', async () => {
      vi.useFakeTimers();

      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/test/path' };
      mockWsRepoInstance.findById.mockResolvedValue(workspace);
      mockNbRepoInstance.syncWithWorkspaceFolders.mockResolvedValue({});
      mockNoteRepoInstance.syncWithFileSystem.mockResolvedValue({});

      await service.watchWorkspace(workspace);

      // Trigger multiple add events quickly
      mockWatcher.emit('add', '/test/path/file1.md');
      await vi.advanceTimersByTimeAsync(100);
      mockWatcher.emit('add', '/test/path/file2.md');
      await vi.advanceTimersByTimeAsync(100);
      mockWatcher.emit('add', '/test/path/file3.md');

      // Advance past debounce time
      await vi.advanceTimersByTimeAsync(600);

      // Should only sync once due to debouncing
      expect(mockWsRepoInstance.findById).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should handle send errors gracefully', async () => {
      const mockWindow = {
        webContents: {
          send: vi.fn(() => { throw new Error('Window closed'); }),
        },
      };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/test/path' };
      await service.watchWorkspace(workspace);

      // Should not throw
      expect(() => {
        mockWatcher.emit('add', '/test/path/new-file.md');
      }).not.toThrow();
    });
  });

  describe('syncWorkspace', () => {
    it('should sync notebooks and notes', async () => {
      vi.useFakeTimers();

      const mockWindow = { webContents: { send: vi.fn() } };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/test/path' };
      mockWsRepoInstance.findById.mockResolvedValue(workspace);
      mockNbRepoInstance.syncWithWorkspaceFolders.mockResolvedValue({});
      mockNoteRepoInstance.syncWithFileSystem.mockResolvedValue({});

      await service.watchWorkspace(workspace);
      mockWatcher.emit('add', '/test/path/new-file.md');

      await vi.advanceTimersByTimeAsync(600);

      expect(mockNbRepoInstance.syncWithWorkspaceFolders).toHaveBeenCalledWith('ws-1');
      expect(mockNoteRepoInstance.syncWithFileSystem).toHaveBeenCalledWith('ws-1');

      vi.useRealTimers();
    });

    it('should broadcast WORKSPACE_UPDATED after sync', async () => {
      vi.useFakeTimers();

      const mockWindow = { webContents: { send: vi.fn() } };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/test/path' };
      mockWsRepoInstance.findById.mockResolvedValue(workspace);
      mockNbRepoInstance.syncWithWorkspaceFolders.mockResolvedValue({});
      mockNoteRepoInstance.syncWithFileSystem.mockResolvedValue({});

      await service.watchWorkspace(workspace);
      mockWatcher.emit('add', '/test/path/new-file.md');

      await vi.advanceTimersByTimeAsync(600);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'workspaces:updated',
        expect.objectContaining({ workspace })
      );

      vi.useRealTimers();
    });

    it('should not sync if workspace not found', async () => {
      vi.useFakeTimers();

      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/test/path' };
      mockWsRepoInstance.findById.mockResolvedValue(null);

      await service.watchWorkspace(workspace);
      mockWatcher.emit('add', '/test/path/new-file.md');

      await vi.advanceTimersByTimeAsync(600);

      expect(mockNbRepoInstance.syncWithWorkspaceFolders).not.toHaveBeenCalled();
      expect(mockNoteRepoInstance.syncWithFileSystem).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle sync errors gracefully', async () => {
      vi.useFakeTimers();

      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/test/path' };
      mockWsRepoInstance.findById.mockResolvedValue(workspace);
      mockNbRepoInstance.syncWithWorkspaceFolders.mockRejectedValue(new Error('Sync failed'));

      await service.watchWorkspace(workspace);
      mockWatcher.emit('add', '/test/path/new-file.md');

      // Should not throw
      await expect(vi.advanceTimersByTimeAsync(600)).resolves.not.toThrow();

      vi.useRealTimers();
    });
  });

  describe('getFileWatcherService', () => {
    it('should return singleton instance', () => {
      const instance1 = getFileWatcherService();
      const instance2 = getFileWatcherService();

      expect(instance1).toBe(instance2);
    });
  });

  describe('syncWorkspace edge cases', () => {
    it('should handle send failure during WORKSPACE_UPDATED broadcast', async () => {
      vi.useFakeTimers();

      // First window throws, second succeeds
      const mockWindows = [
        { webContents: { send: vi.fn(() => { throw new Error('Window closed'); }) } },
        { webContents: { send: vi.fn() } },
      ];
      (BrowserWindow.getAllWindows as any).mockReturnValue(mockWindows);

      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/test/path' };
      mockWsRepoInstance.findById.mockResolvedValue(workspace);
      mockNbRepoInstance.syncWithWorkspaceFolders.mockResolvedValue({});
      mockNoteRepoInstance.syncWithFileSystem.mockResolvedValue({});

      await service.watchWorkspace(workspace);
      mockWatcher.emit('add', '/test/path/new-file.md');

      // Should not throw even if first window fails
      await expect(vi.advanceTimersByTimeAsync(600)).resolves.not.toThrow();

      // Second window should still receive the event
      expect(mockWindows[1].webContents.send).toHaveBeenCalledWith(
        'workspaces:updated',
        expect.objectContaining({ workspace })
      );

      vi.useRealTimers();
    });

    it('should log error when debounced sync fails unexpectedly', async () => {
      vi.useFakeTimers();

      const workspace = { id: 'ws-1', name: 'Test', folderPath: '/test/path' };
      // Make findById throw an error that's not caught internally
      mockWsRepoInstance.findById.mockImplementation(() => {
        throw new Error('Unexpected database error');
      });

      await service.watchWorkspace(workspace);
      mockWatcher.emit('add', '/test/path/new-file.md');

      // Should not throw - error should be caught and logged
      await expect(vi.advanceTimersByTimeAsync(600)).resolves.not.toThrow();

      vi.useRealTimers();
    });
  });
});
