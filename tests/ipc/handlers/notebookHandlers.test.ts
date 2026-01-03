/**
 * Notebook IPC Handler Tests
 *
 * Tests IPC layer concerns: parameter mapping, error code mapping, response formatting.
 * Business logic is tested in NotebookService.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron before importing handlers
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock NotebookService
const mockNotebookService = {
  createNotebook: vi.fn(),
  updateNotebook: vi.fn(),
  deleteNotebook: vi.fn(),
  getAllFlat: vi.fn(),
  getTree: vi.fn(),
  getNoteCount: vi.fn(),
  moveNotebook: vi.fn(),
  syncWithWorkspace: vi.fn(),
};

vi.mock('../../../src/main/services/NotebookService', () => ({
  getNotebookService: vi.fn(() => mockNotebookService),
}));

// Import after mocks
import { registerNotebookHandlers } from '../../../src/main/ipc/handlers/notebookHandlers';
import { ipcMain } from 'electron';

// Create mock container
const mockContainer = {
  cradle: {
    notebookService: mockNotebookService,
  },
} as any;

describe('Notebook IPC Handlers', () => {
  let registeredHandlers: Map<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers = new Map();

    (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    });

    registerNotebookHandlers(mockContainer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('notebooks:create', () => {
    it('should call service and return formatted response', async () => {
      const mockNotebook = {
        id: 'nb-1',
        name: 'Test Notebook',
        parentId: null,
        note_count: 0,
      };
      mockNotebookService.createNotebook.mockResolvedValue(mockNotebook);

      const handler = registeredHandlers.get('notebooks:create');
      const result = await handler({}, { name: 'Test Notebook' });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Test Notebook');
      expect(mockNotebookService.createNotebook).toHaveBeenCalledWith({
        name: 'Test Notebook',
        parentId: undefined,
        icon: undefined,
        color: undefined,
        position: undefined,
      });
    });

    it('should map errors to INTERNAL_ERROR code', async () => {
      mockNotebookService.createNotebook.mockRejectedValue(new Error('Creation failed'));

      const handler = registeredHandlers.get('notebooks:create');
      const result = await handler({}, { name: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('notebooks:update', () => {
    it('should call service with id and update fields', async () => {
      const mockNotebook = { id: 'nb-1', name: 'Updated Name' };
      mockNotebookService.updateNotebook.mockResolvedValue(mockNotebook);

      const handler = registeredHandlers.get('notebooks:update');
      const result = await handler({}, { id: 'nb-1', name: 'Updated Name' });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Updated Name');
      expect(mockNotebookService.updateNotebook).toHaveBeenCalledWith('nb-1', {
        name: 'Updated Name',
        icon: undefined,
        color: undefined,
        position: undefined,
      });
    });
  });

  describe('notebooks:delete', () => {
    it('should call service and return success', async () => {
      mockNotebookService.deleteNotebook.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('notebooks:delete');
      const result = await handler({}, { id: 'nb-1' });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(mockNotebookService.deleteNotebook).toHaveBeenCalledWith('nb-1', undefined);
    });

    it('should pass delete_notes flag to service', async () => {
      mockNotebookService.deleteNotebook.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('notebooks:delete');
      await handler({}, { id: 'nb-1', delete_notes: true });

      expect(mockNotebookService.deleteNotebook).toHaveBeenCalledWith('nb-1', true);
    });
  });

  describe('notebooks:getAll', () => {
    it('should return tree structure by default', async () => {
      const mockTree = [{ id: 'nb-1', name: 'Root', children: [] }];
      mockNotebookService.getTree.mockResolvedValue(mockTree);

      const handler = registeredHandlers.get('notebooks:getAll');
      const result = await handler({}, {});

      expect(result.success).toBe(true);
      expect(result.data.notebooks).toEqual(mockTree);
      expect(mockNotebookService.getTree).toHaveBeenCalled();
    });

    it('should return flat list when flat=true', async () => {
      const mockNotebooks = [{ id: 'nb-1', name: 'Notebook 1', note_count: 5 }];
      mockNotebookService.getAllFlat.mockResolvedValue(mockNotebooks);

      const handler = registeredHandlers.get('notebooks:getAll');
      const result = await handler({}, { flat: true, include_counts: true });

      expect(result.data.notebooks).toEqual(mockNotebooks);
      expect(mockNotebookService.getAllFlat).toHaveBeenCalledWith(true);
    });
  });

  describe('notebooks:move', () => {
    it('should call service with move parameters', async () => {
      const mockNotebook = { id: 'nb-1', parentId: 'nb-2', position: 0 };
      mockNotebookService.moveNotebook.mockResolvedValue(mockNotebook);

      const handler = registeredHandlers.get('notebooks:move');
      const result = await handler({}, { id: 'nb-1', parentId: 'nb-2', position: 0 });

      expect(result.success).toBe(true);
      expect(result.data.parentId).toBe('nb-2');
      expect(mockNotebookService.moveNotebook).toHaveBeenCalledWith('nb-1', 'nb-2', 0);
    });

    it('should map invalid move error to INVALID_OPERATION code', async () => {
      mockNotebookService.moveNotebook.mockRejectedValue(
        new Error('Cannot move notebook into itself'),
      );

      const handler = registeredHandlers.get('notebooks:move');
      const result = await handler({}, { id: 'nb-1', parentId: 'nb-1' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_OPERATION');
    });
  });
});
