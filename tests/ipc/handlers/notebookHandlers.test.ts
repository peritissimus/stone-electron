/**
 * Notebook IPC Handler Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron before importing handlers
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [
      { webContents: { send: vi.fn() } },
    ]),
  },
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock repositories
const mockNotebookRepo = {
  create: vi.fn(),
  update: vi.fn(),
  deleteWithNotes: vi.fn(),
  getFlatList: vi.fn(),
  getTree: vi.fn(),
  getNoteCount: vi.fn(),
  move: vi.fn(),
};

vi.mock('../../../src/main/repositories', () => ({
  getRepositories: vi.fn(() => ({
    notebook: mockNotebookRepo,
  })),
}));

// Import after mocks
import { registerNotebookHandlers } from '../../../src/main/ipc/handlers/notebookHandlers';
import { ipcMain, BrowserWindow } from 'electron';

describe('Notebook IPC Handlers', () => {
  let registeredHandlers: Map<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers = new Map();

    // Capture registered handlers
    (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    });

    registerNotebookHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('notebooks:create', () => {
    it('should create a new notebook with defaults', async () => {
      const mockNotebook = {
        id: 'nb-1',
        name: 'Test Notebook',
        parentId: null,
        icon: '📁',
        color: '#3b82f6',
        position: 0,
        createdAt: new Date(),
      };
      mockNotebookRepo.create.mockResolvedValue(mockNotebook);
      mockNotebookRepo.getNoteCount.mockResolvedValue(0);

      const handler = registeredHandlers.get('notebooks:create');
      const result = await handler({}, { name: 'Test Notebook' });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Test Notebook');
      expect(result.data.note_count).toBe(0);
      expect(mockNotebookRepo.create).toHaveBeenCalledWith({
        name: 'Test Notebook',
        parentId: null,
        icon: '📁',
        color: '#3b82f6',
        position: 0,
      });
    });

    it('should create a nested notebook with parentId', async () => {
      const mockNotebook = {
        id: 'nb-2',
        name: 'Child Notebook',
        parentId: 'nb-1',
        icon: '📂',
        color: '#ff0000',
        position: 1,
        createdAt: new Date(),
      };
      mockNotebookRepo.create.mockResolvedValue(mockNotebook);
      mockNotebookRepo.getNoteCount.mockResolvedValue(0);

      const handler = registeredHandlers.get('notebooks:create');
      const result = await handler({}, {
        name: 'Child Notebook',
        parentId: 'nb-1',
        icon: '📂',
        color: '#ff0000',
        position: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data.parentId).toBe('nb-1');
      expect(mockNotebookRepo.create).toHaveBeenCalledWith({
        name: 'Child Notebook',
        parentId: 'nb-1',
        icon: '📂',
        color: '#ff0000',
        position: 1,
      });
    });

    it('should broadcast notebook created event', async () => {
      const mockWindow = { webContents: { send: vi.fn() } };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      mockNotebookRepo.create.mockResolvedValue({ id: 'nb-1', name: 'Test' });
      mockNotebookRepo.getNoteCount.mockResolvedValue(0);

      const handler = registeredHandlers.get('notebooks:create');
      await handler({}, { name: 'Test' });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'notebooks:created',
        expect.objectContaining({ notebook: expect.any(Object) })
      );
    });
  });

  describe('notebooks:update', () => {
    it('should update notebook properties', async () => {
      const mockNotebook = {
        id: 'nb-1',
        name: 'Updated Name',
        icon: '📚',
        color: '#00ff00',
        position: 2,
      };
      mockNotebookRepo.update.mockResolvedValue(mockNotebook);

      const handler = registeredHandlers.get('notebooks:update');
      const result = await handler({}, {
        id: 'nb-1',
        name: 'Updated Name',
        icon: '📚',
        color: '#00ff00',
        position: 2,
      });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Updated Name');
    });

    it('should only update provided fields', async () => {
      mockNotebookRepo.update.mockResolvedValue({ id: 'nb-1', name: 'New Name' });

      const handler = registeredHandlers.get('notebooks:update');
      await handler({}, { id: 'nb-1', name: 'New Name' });

      expect(mockNotebookRepo.update).toHaveBeenCalledWith('nb-1', { name: 'New Name' });
    });
  });

  describe('notebooks:delete', () => {
    it('should delete notebook and orphan notes by default', async () => {
      mockNotebookRepo.deleteWithNotes.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('notebooks:delete');
      const result = await handler({}, { id: 'nb-1' });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(mockNotebookRepo.deleteWithNotes).toHaveBeenCalledWith('nb-1', 'orphan');
    });

    it('should delete notebook and delete notes when requested', async () => {
      mockNotebookRepo.deleteWithNotes.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('notebooks:delete');
      await handler({}, { id: 'nb-1', delete_notes: true });

      expect(mockNotebookRepo.deleteWithNotes).toHaveBeenCalledWith('nb-1', 'delete');
    });

    it('should broadcast notebook deleted event', async () => {
      const mockWindow = { webContents: { send: vi.fn() } };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      mockNotebookRepo.deleteWithNotes.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('notebooks:delete');
      await handler({}, { id: 'nb-1' });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'notebooks:deleted',
        { id: 'nb-1' }
      );
    });
  });

  describe('notebooks:getAll', () => {
    it('should return flat list when requested', async () => {
      const mockNotebooks = [
        { id: 'nb-1', name: 'Notebook 1' },
        { id: 'nb-2', name: 'Notebook 2' },
      ];
      mockNotebookRepo.getFlatList.mockResolvedValue(mockNotebooks);
      mockNotebookRepo.getNoteCount.mockResolvedValue(5);

      const handler = registeredHandlers.get('notebooks:getAll');
      const result = await handler({}, { flat: true, include_counts: true });

      expect(result.success).toBe(true);
      expect(result.data.notebooks.length).toBe(2);
      expect(result.data.notebooks[0].note_count).toBe(5);
    });

    it('should return flat list without counts', async () => {
      const mockNotebooks = [{ id: 'nb-1', name: 'Notebook 1' }];
      mockNotebookRepo.getFlatList.mockResolvedValue(mockNotebooks);

      const handler = registeredHandlers.get('notebooks:getAll');
      const result = await handler({}, { flat: true, include_counts: false });

      expect(result.data.notebooks[0].note_count).toBe(0);
    });

    it('should return tree structure by default', async () => {
      const mockTree = [
        { id: 'nb-1', name: 'Root', children: [{ id: 'nb-2', name: 'Child' }] },
      ];
      mockNotebookRepo.getTree.mockResolvedValue(mockTree);

      const handler = registeredHandlers.get('notebooks:getAll');
      const result = await handler({}, {});

      expect(result.success).toBe(true);
      expect(result.data.notebooks).toEqual(mockTree);
    });
  });

  describe('notebooks:move', () => {
    it('should move notebook to new parent', async () => {
      const mockNotebook = { id: 'nb-1', parentId: 'nb-2', position: 0 };
      mockNotebookRepo.move.mockResolvedValue(mockNotebook);

      const handler = registeredHandlers.get('notebooks:move');
      const result = await handler({}, { id: 'nb-1', parentId: 'nb-2', position: 0 });

      expect(result.success).toBe(true);
      expect(result.data.parentId).toBe('nb-2');
      expect(mockNotebookRepo.move).toHaveBeenCalledWith('nb-1', 'nb-2', 0);
    });

    it('should move notebook to root', async () => {
      const mockNotebook = { id: 'nb-1', parentId: null, position: 0 };
      mockNotebookRepo.move.mockResolvedValue(mockNotebook);

      const handler = registeredHandlers.get('notebooks:move');
      const result = await handler({}, { id: 'nb-1' });

      expect(result.data.parentId).toBeNull();
      expect(mockNotebookRepo.move).toHaveBeenCalledWith('nb-1', null, undefined);
    });

    it('should return error for invalid move operation', async () => {
      mockNotebookRepo.move.mockRejectedValue(new Error('Cannot move notebook into itself'));

      const handler = registeredHandlers.get('notebooks:move');
      const result = await handler({}, { id: 'nb-1', parentId: 'nb-1' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_OPERATION');
    });
  });
});
