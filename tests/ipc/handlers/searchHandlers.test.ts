/**
 * Search IPC Handler Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron before importing handlers
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock repositories
const mockNoteRepo = {
  searchFullText: vi.fn(),
  findByTags: vi.fn(),
  findByTagsAny: vi.fn(),
  findByDateRange: vi.fn(),
};

const mockTagRepo = {
  getTagsForNotes: vi.fn(),
};

vi.mock('../../../src/main/repositories', () => ({
  getRepositories: vi.fn(() => ({
    note: mockNoteRepo,
    tag: mockTagRepo,
  })),
}));

// Import after mocks
import { registerSearchHandlers } from '../../../src/main/ipc/handlers/searchHandlers';
import { ipcMain } from 'electron';

describe('Search IPC Handlers', () => {
  let registeredHandlers: Map<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers = new Map();

    // Capture registered handlers
    (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    });

    registerSearchHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('search:fullText', () => {
    it('should search notes by query', async () => {
      const mockNotes = [
        { id: 'note-1', title: 'Test Note', notebookId: 'nb-1' },
        { id: 'note-2', title: 'Another Note', notebookId: 'nb-2' },
      ];
      mockNoteRepo.searchFullText.mockResolvedValue(mockNotes);

      const handler = registeredHandlers.get('search:fullText');
      const result = await handler({}, { query: 'test' });

      expect(result.success).toBe(true);
      expect(result.data.results.length).toBe(2);
      expect(result.data.total).toBe(2);
      expect(result.data.query_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('should filter by notebook', async () => {
      const mockNotes = [
        { id: 'note-1', title: 'Test Note', notebookId: 'nb-1' },
        { id: 'note-2', title: 'Another Note', notebookId: 'nb-2' },
      ];
      mockNoteRepo.searchFullText.mockResolvedValue(mockNotes);

      const handler = registeredHandlers.get('search:fullText');
      const result = await handler({}, { query: 'test', notebookId: 'nb-1' });

      expect(result.data.results.length).toBe(1);
      expect(result.data.results[0].notebookId).toBe('nb-1');
    });

    it('should filter by tags', async () => {
      const mockNotes = [
        { id: 'note-1', title: 'Test Note' },
        { id: 'note-2', title: 'Another Note' },
      ];
      mockNoteRepo.searchFullText.mockResolvedValue(mockNotes);
      mockTagRepo.getTagsForNotes.mockResolvedValue(new Map([
        ['note-1', [{ id: 'tag-1', name: 'important' }]],
        ['note-2', [{ id: 'tag-2', name: 'work' }]],
      ]));

      const handler = registeredHandlers.get('search:fullText');
      const result = await handler({}, { query: 'test', tagIds: ['tag-1'] });

      expect(result.data.results.length).toBe(1);
      expect(result.data.results[0].id).toBe('note-1');
    });

    it('should use default limit of 50', async () => {
      mockNoteRepo.searchFullText.mockResolvedValue([]);

      const handler = registeredHandlers.get('search:fullText');
      await handler({}, { query: 'test' });

      expect(mockNoteRepo.searchFullText).toHaveBeenCalledWith('test', 50);
    });

    it('should respect custom limit', async () => {
      mockNoteRepo.searchFullText.mockResolvedValue([]);

      const handler = registeredHandlers.get('search:fullText');
      await handler({}, { query: 'test', limit: 10 });

      expect(mockNoteRepo.searchFullText).toHaveBeenCalledWith('test', 10);
    });

    it('should add relevance and highlight to results', async () => {
      mockNoteRepo.searchFullText.mockResolvedValue([
        { id: 'note-1', title: 'Test Note' },
      ]);

      const handler = registeredHandlers.get('search:fullText');
      const result = await handler({}, { query: 'test' });

      expect(result.data.results[0].relevance).toBe(1.0);
      expect(result.data.results[0].title_highlight).toBe('Test Note');
    });
  });

  describe('search:semantic', () => {
    it('should search notes semantically (fallback to FTS)', async () => {
      const mockNotes = [
        { id: 'note-1', title: 'Test Note' },
      ];
      mockNoteRepo.searchFullText.mockResolvedValue(mockNotes);

      const handler = registeredHandlers.get('search:semantic');
      const result = await handler({}, { query: 'test', threshold: 0.5, limit: 10 });

      expect(result.success).toBe(true);
      expect(result.data.results.length).toBe(1);
      expect(result.data.results[0].similarity).toBe(0.8);
    });

    it('should use default limit of 20', async () => {
      mockNoteRepo.searchFullText.mockResolvedValue([]);

      const handler = registeredHandlers.get('search:semantic');
      await handler({}, { query: 'test' });

      expect(mockNoteRepo.searchFullText).toHaveBeenCalledWith('test', 20);
    });
  });

  describe('search:hybrid', () => {
    it('should perform hybrid search', async () => {
      const mockNotes = [
        { id: 'note-1', title: 'Test Note' },
      ];
      mockNoteRepo.searchFullText.mockResolvedValue(mockNotes);

      const handler = registeredHandlers.get('search:hybrid');
      const result = await handler({}, { query: 'test', weights: { fts: 0.7, semantic: 0.3 } });

      expect(result.success).toBe(true);
      expect(result.data.results[0].score).toBe(1.0);
      expect(result.data.results[0].search_type).toBe('fts');
    });
  });

  describe('search:byTag', () => {
    it('should search notes by tags with OR logic', async () => {
      const mockNotes = [
        { id: 'note-1', title: 'Note 1' },
        { id: 'note-2', title: 'Note 2' },
      ];
      mockNoteRepo.findByTagsAny.mockResolvedValue(mockNotes);

      const handler = registeredHandlers.get('search:byTag');
      const result = await handler({}, { tagIds: ['tag-1', 'tag-2'] });

      expect(result.success).toBe(true);
      expect(result.data.notes.length).toBe(2);
      expect(mockNoteRepo.findByTagsAny).toHaveBeenCalledWith(['tag-1', 'tag-2']);
    });

    it('should search notes by tags with AND logic', async () => {
      const mockNotes = [
        { id: 'note-1', title: 'Note 1' },
      ];
      mockNoteRepo.findByTags.mockResolvedValue(mockNotes);

      const handler = registeredHandlers.get('search:byTag');
      const result = await handler({}, { tagIds: ['tag-1', 'tag-2'], match_all: true });

      expect(result.success).toBe(true);
      expect(mockNoteRepo.findByTags).toHaveBeenCalledWith(['tag-1', 'tag-2']);
    });

    it('should apply limit and offset', async () => {
      const mockNotes = Array.from({ length: 20 }, (_, i) => ({
        id: `note-${i}`,
        title: `Note ${i}`,
      }));
      mockNoteRepo.findByTagsAny.mockResolvedValue(mockNotes);

      const handler = registeredHandlers.get('search:byTag');
      const result = await handler({}, { tagIds: ['tag-1'], limit: 5, offset: 10 });

      expect(result.data.notes.length).toBe(5);
      expect(result.data.notes[0].id).toBe('note-10');
      expect(result.data.total).toBe(20);
    });
  });

  describe('search:byDateRange', () => {
    it('should search notes by date range', async () => {
      const mockNotes = [
        { id: 'note-1', title: 'Note 1', createdAt: new Date('2024-01-15') },
      ];
      mockNoteRepo.findByDateRange.mockResolvedValue(mockNotes);

      const handler = registeredHandlers.get('search:byDateRange');
      const result = await handler({}, {
        start_date: new Date('2024-01-01').getTime(),
        end_date: new Date('2024-01-31').getTime(),
      });

      expect(result.success).toBe(true);
      expect(result.data.notes.length).toBe(1);
      expect(mockNoteRepo.findByDateRange).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date),
        'updatedAt'
      );
    });

    it('should use createdAt field when specified', async () => {
      mockNoteRepo.findByDateRange.mockResolvedValue([]);

      const handler = registeredHandlers.get('search:byDateRange');
      await handler({}, {
        start_date: Date.now(),
        end_date: Date.now(),
        field: 'created',
      });

      expect(mockNoteRepo.findByDateRange).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date),
        'createdAt'
      );
    });

    it('should apply limit to results', async () => {
      const mockNotes = Array.from({ length: 20 }, (_, i) => ({
        id: `note-${i}`,
      }));
      mockNoteRepo.findByDateRange.mockResolvedValue(mockNotes);

      const handler = registeredHandlers.get('search:byDateRange');
      const result = await handler({}, {
        start_date: Date.now(),
        end_date: Date.now(),
        limit: 5,
      });

      expect(result.data.notes.length).toBe(5);
      expect(result.data.total).toBe(20);
    });
  });
});
