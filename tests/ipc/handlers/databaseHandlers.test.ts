/**
 * Database IPC Handler Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron before importing handlers
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock EventBus
const mockEventBus = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock('../../../src/main/services/EventBus', () => ({
  getEventBus: vi.fn(() => mockEventBus),
}));

// Mock database manager
const mockDbManager = {
  getStatus: vi.fn(),
  optimize: vi.fn(),
  checkIntegrity: vi.fn(),
};

vi.mock('../../../src/main/database', () => ({
  getDatabaseManager: vi.fn(() => mockDbManager),
}));

// Import after mocks
import { registerDatabaseHandlers } from '../../../src/main/ipc/handlers/databaseHandlers';
import { ipcMain } from 'electron';

// Create mock container
const mockContainer = {
  cradle: {
    db: mockDbManager,
    eventBus: mockEventBus,
  },
} as any;

describe('Database IPC Handlers', () => {
  let registeredHandlers: Map<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers = new Map();

    // Capture registered handlers
    (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    });

    registerDatabaseHandlers(mockContainer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('db:getStatus', () => {
    it('should return database status', async () => {
      mockDbManager.getStatus.mockResolvedValue({
        databaseSize: 1024000,
        noteCount: 100,
        notebookCount: 10,
        tagCount: 25,
      });

      const handler = registeredHandlers.get('db:getStatus');
      const result = await handler({}, {});

      expect(result.success).toBe(true);
      expect(result.data.databaseSize).toBe(1024000);
      expect(result.data.noteCount).toBe(100);
      expect(result.data.is_migrating).toBe(false);
      expect(result.data.vector_size).toBe(0);
    });
  });

  describe('db:vacuum', () => {
    it('should vacuum database and return size reduction', async () => {
      mockDbManager.getStatus
        .mockResolvedValueOnce({ databaseSize: 2048000 }) // before
        .mockResolvedValueOnce({ databaseSize: 1024000 }); // after
      mockDbManager.optimize.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('db:vacuum');
      const result = await handler({}, {});

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.size_before).toBe(2048000);
      expect(result.data.size_after).toBe(1024000);
      expect(result.data.freed_bytes).toBe(1024000);
      expect(mockDbManager.optimize).toHaveBeenCalled();
    });

    it('should emit progress and completion events', async () => {
      mockDbManager.getStatus
        .mockResolvedValueOnce({ databaseSize: 1024 })
        .mockResolvedValueOnce({ databaseSize: 1024 });
      mockDbManager.optimize.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('db:vacuum');
      await handler({}, {});

      expect(mockEventBus.emit).toHaveBeenCalledWith('db:vacuumProgress', {});
      expect(mockEventBus.emit).toHaveBeenCalledWith('db:vacuumComplete', {});
    });

    it('should return 0 freed bytes if size increases', async () => {
      mockDbManager.getStatus
        .mockResolvedValueOnce({ databaseSize: 1000 })
        .mockResolvedValueOnce({ databaseSize: 1500 });
      mockDbManager.optimize.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('db:vacuum');
      const result = await handler({}, {});

      expect(result.data.freed_bytes).toBe(0);
    });
  });

  describe('db:checkIntegrity', () => {
    it('should return integrity check results', async () => {
      mockDbManager.checkIntegrity.mockResolvedValue({
        ok: true,
        errors: [],
      });

      const handler = registeredHandlers.get('db:checkIntegrity');
      const result = await handler({}, { detailed: false });

      expect(result.success).toBe(true);
      expect(result.data.ok).toBe(true);
      expect(result.data.foreign_keys_ok).toBe(true);
      expect(result.data.errors).toEqual([]);
      expect(result.data.warnings).toEqual([]);
    });

    it('should return errors when integrity check fails', async () => {
      mockDbManager.checkIntegrity.mockResolvedValue({
        ok: false,
        errors: ['Table notes is corrupted'],
      });

      const handler = registeredHandlers.get('db:checkIntegrity');
      const result = await handler({}, { detailed: true });

      expect(result.data.ok).toBe(false);
      expect(result.data.errors).toContain('Table notes is corrupted');
    });
  });
});
