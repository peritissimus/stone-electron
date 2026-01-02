/**
 * NotebookService Tests
 *
 * Unit tests for notebook management service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
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
  syncWithWorkspaceFolders: vi.fn(),
};

vi.mock('../../src/main/repositories', () => ({
  getRepositories: vi.fn(() => ({
    notebook: mockNotebookRepo,
  })),
}));

// Mock EventBus
const mockEventBus = {
  emit: vi.fn(),
};

vi.mock('../../src/main/services/EventBus', () => ({
  getEventBus: vi.fn(() => mockEventBus),
}));

// Import after mocks
import { getNotebookService } from '../../src/main/services/NotebookService';

describe('NotebookService', () => {
  let notebookService: ReturnType<typeof getNotebookService>;

  beforeEach(() => {
    vi.clearAllMocks();
    notebookService = getNotebookService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createNotebook', () => {
    it('should create a notebook with defaults', async () => {
      const mockNotebook = {
        id: 'nb-1',
        name: 'Test Notebook',
        parentId: null,
        icon: '📁',
        color: '#3b82f6',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockNotebookRepo.create.mockResolvedValue(mockNotebook);
      mockNotebookRepo.getNoteCount.mockResolvedValue(0);

      const result = await notebookService.createNotebook({ name: 'Test Notebook' });

      expect(result.name).toBe('Test Notebook');
      expect(result.icon).toBe('📁');
      expect(result.note_count).toBe(0);
      expect(mockEventBus.emit).toHaveBeenCalledWith('notebooks:created', { notebook: mockNotebook });
    });

    it('should create a notebook with custom values', async () => {
      const mockNotebook = {
        id: 'nb-1',
        name: 'Custom',
        parentId: 'parent-1',
        icon: '📚',
        color: '#ff0000',
        position: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockNotebookRepo.create.mockResolvedValue(mockNotebook);
      mockNotebookRepo.getNoteCount.mockResolvedValue(3);

      const result = await notebookService.createNotebook({
        name: 'Custom',
        parentId: 'parent-1',
        icon: '📚',
        color: '#ff0000',
        position: 5,
      });

      expect(result.parentId).toBe('parent-1');
      expect(result.icon).toBe('📚');
      expect(result.note_count).toBe(3);
    });
  });

  describe('updateNotebook', () => {
    it('should update notebook name', async () => {
      const mockNotebook = { id: 'nb-1', name: 'Updated Name' };
      mockNotebookRepo.update.mockResolvedValue(mockNotebook);

      const result = await notebookService.updateNotebook('nb-1', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(mockEventBus.emit).toHaveBeenCalledWith('notebooks:updated', { notebook: mockNotebook });
    });

    it('should update multiple fields', async () => {
      const mockNotebook = { id: 'nb-1', name: 'Updated', icon: '🌟', color: '#00ff00' };
      mockNotebookRepo.update.mockResolvedValue(mockNotebook);

      const result = await notebookService.updateNotebook('nb-1', {
        name: 'Updated',
        icon: '🌟',
        color: '#00ff00',
      });

      expect(result.icon).toBe('🌟');
      expect(result.color).toBe('#00ff00');
    });
  });

  describe('deleteNotebook', () => {
    it('should delete notebook and orphan notes by default', async () => {
      mockNotebookRepo.deleteWithNotes.mockResolvedValue(undefined);

      await notebookService.deleteNotebook('nb-1');

      expect(mockNotebookRepo.deleteWithNotes).toHaveBeenCalledWith('nb-1', 'orphan');
      expect(mockEventBus.emit).toHaveBeenCalledWith('notebooks:deleted', { id: 'nb-1' });
    });

    it('should delete notebook and notes when requested', async () => {
      mockNotebookRepo.deleteWithNotes.mockResolvedValue(undefined);

      await notebookService.deleteNotebook('nb-1', true);

      expect(mockNotebookRepo.deleteWithNotes).toHaveBeenCalledWith('nb-1', 'delete');
    });
  });

  describe('getAllFlat', () => {
    it('should return flat list without counts', async () => {
      const mockNotebooks = [
        { id: 'nb-1', name: 'Notebook 1' },
        { id: 'nb-2', name: 'Notebook 2' },
      ];
      mockNotebookRepo.getFlatList.mockResolvedValue(mockNotebooks);

      const result = await notebookService.getAllFlat(false);

      expect(result.length).toBe(2);
      expect(result[0].note_count).toBe(0);
      expect(result[1].note_count).toBe(0);
    });

    it('should return flat list with counts', async () => {
      const mockNotebooks = [
        { id: 'nb-1', name: 'Notebook 1' },
        { id: 'nb-2', name: 'Notebook 2' },
      ];
      mockNotebookRepo.getFlatList.mockResolvedValue(mockNotebooks);
      mockNotebookRepo.getNoteCount.mockImplementation(async (id: string) => {
        return id === 'nb-1' ? 5 : 3;
      });

      const result = await notebookService.getAllFlat(true);

      expect(result[0].note_count).toBe(5);
      expect(result[1].note_count).toBe(3);
    });
  });

  describe('getTree', () => {
    it('should return notebook tree', async () => {
      const mockTree = [
        {
          id: 'nb-1',
          name: 'Parent',
          children: [{ id: 'nb-2', name: 'Child' }],
        },
      ];
      mockNotebookRepo.getTree.mockResolvedValue(mockTree);

      const result = await notebookService.getTree();

      expect(result).toEqual(mockTree);
    });
  });

  describe('getNoteCount', () => {
    it('should return note count for notebook', async () => {
      mockNotebookRepo.getNoteCount.mockResolvedValue(10);

      const result = await notebookService.getNoteCount('nb-1');

      expect(result).toBe(10);
    });
  });

  describe('moveNotebook', () => {
    it('should move notebook to new parent', async () => {
      const mockNotebook = { id: 'nb-1', parentId: 'new-parent' };
      mockNotebookRepo.move.mockResolvedValue(mockNotebook);

      const result = await notebookService.moveNotebook('nb-1', 'new-parent');

      expect(result.parentId).toBe('new-parent');
      expect(mockNotebookRepo.move).toHaveBeenCalledWith('nb-1', 'new-parent', undefined);
      expect(mockEventBus.emit).toHaveBeenCalledWith('notebooks:updated', { notebook: mockNotebook });
    });

    it('should move notebook to root', async () => {
      const mockNotebook = { id: 'nb-1', parentId: null };
      mockNotebookRepo.move.mockResolvedValue(mockNotebook);

      const result = await notebookService.moveNotebook('nb-1', null);

      expect(result.parentId).toBeNull();
    });

    it('should move notebook with position', async () => {
      const mockNotebook = { id: 'nb-1', parentId: 'parent', position: 3 };
      mockNotebookRepo.move.mockResolvedValue(mockNotebook);

      const result = await notebookService.moveNotebook('nb-1', 'parent', 3);

      expect(mockNotebookRepo.move).toHaveBeenCalledWith('nb-1', 'parent', 3);
    });
  });

  describe('syncWithWorkspace', () => {
    it('should sync notebooks with workspace folders', async () => {
      const mockResult = { created: 3, updated: 1, errors: [] };
      mockNotebookRepo.syncWithWorkspaceFolders.mockResolvedValue(mockResult);

      const result = await notebookService.syncWithWorkspace('ws-1');

      expect(result).toEqual(mockResult);
      expect(mockNotebookRepo.syncWithWorkspaceFolders).toHaveBeenCalledWith('ws-1');
    });
  });

  describe('getNotebookService', () => {
    it('should return singleton instance', () => {
      const instance1 = getNotebookService();
      const instance2 = getNotebookService();

      expect(instance1).toBe(instance2);
    });
  });
});
