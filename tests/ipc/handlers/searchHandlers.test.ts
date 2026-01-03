/**
 * Search IPC Handler Tests
 *
 * Tests IPC layer concerns: parameter mapping, response formatting.
 * Business logic is tested in SearchService.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron before importing handlers
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../../src/main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock SearchService
const mockSearchService = {
  searchFullText: vi.fn(),
  semanticSearch: vi.fn(),
};

vi.mock('../../../src/main/services/SearchService', () => ({
  getSearchService: vi.fn(() => mockSearchService),
}));

// Mock repositories (still used for some filtering operations)
const mockNoteRepo = {
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

// Create mock container
const mockContainer = {
  cradle: {
    noteRepository: mockNoteRepo,
    tagRepository: mockTagRepo,
    searchService: mockSearchService,
  },
} as any;

describe('Search IPC Handlers', () => {
  let registeredHandlers: Map<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers = new Map();

    (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    });

    registerSearchHandlers(mockContainer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('search:fullText', () => {
    it('should call service and return formatted results', async () => {
      const mockResults = [
        { note: { id: 'note-1', title: 'Test Note' }, matchType: 'title' },
      ];
      mockSearchService.searchFullText.mockResolvedValue(mockResults);

      const handler = registeredHandlers.get('search:fullText');
      const result = await handler({}, { query: 'test' });

      expect(result.success).toBe(true);
      expect(result.data.results.length).toBe(1);
      expect(result.data.total).toBe(1);
      expect(result.data.query_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('should use default limit of 50', async () => {
      mockSearchService.searchFullText.mockResolvedValue([]);

      const handler = registeredHandlers.get('search:fullText');
      await handler({}, { query: 'test' });

      expect(mockSearchService.searchFullText).toHaveBeenCalledWith('test', 50);
    });

    it('should pass custom limit to service', async () => {
      mockSearchService.searchFullText.mockResolvedValue([]);

      const handler = registeredHandlers.get('search:fullText');
      await handler({}, { query: 'test', limit: 10 });

      expect(mockSearchService.searchFullText).toHaveBeenCalledWith('test', 10);
    });
  });

  describe('search:semantic', () => {
    it('should call service and compute similarity from distance', async () => {
      const mockResults = [{ noteId: 'note-1', title: 'Test Note', distance: 0.2 }];
      mockSearchService.semanticSearch.mockResolvedValue(mockResults);

      const handler = registeredHandlers.get('search:semantic');
      const result = await handler({}, { query: 'test' });

      expect(result.success).toBe(true);
      expect(result.data.results[0].similarity).toBe(0.8); // 1 - distance
    });

    it('should use default limit of 20', async () => {
      mockSearchService.semanticSearch.mockResolvedValue([]);

      const handler = registeredHandlers.get('search:semantic');
      await handler({}, { query: 'test' });

      expect(mockSearchService.semanticSearch).toHaveBeenCalledWith('test', 20);
    });
  });

  describe('search:hybrid', () => {
    it('should perform hybrid search using fullText service', async () => {
      const mockResults = [{ note: { id: 'note-1', title: 'Test' }, matchType: 'title' }];
      mockSearchService.searchFullText.mockResolvedValue(mockResults);

      const handler = registeredHandlers.get('search:hybrid');
      const result = await handler({}, { query: 'test', weights: { fts: 0.7, semantic: 0.3 } });

      expect(result.success).toBe(true);
      expect(result.data.results[0].search_type).toBe('fts');
    });
  });

  describe('search:byTag', () => {
    it('should use findByTagsAny for OR logic (default)', async () => {
      const mockNotes = [{ id: 'note-1', title: 'Note 1' }];
      mockNoteRepo.findByTagsAny.mockResolvedValue(mockNotes);

      const handler = registeredHandlers.get('search:byTag');
      const result = await handler({}, { tagIds: ['tag-1', 'tag-2'] });

      expect(result.success).toBe(true);
      expect(mockNoteRepo.findByTagsAny).toHaveBeenCalledWith(['tag-1', 'tag-2']);
    });

    it('should use findByTags for AND logic when match_all=true', async () => {
      const mockNotes = [{ id: 'note-1', title: 'Note 1' }];
      mockNoteRepo.findByTags.mockResolvedValue(mockNotes);

      const handler = registeredHandlers.get('search:byTag');
      await handler({}, { tagIds: ['tag-1', 'tag-2'], match_all: true });

      expect(mockNoteRepo.findByTags).toHaveBeenCalledWith(['tag-1', 'tag-2']);
    });
  });

  describe('search:byDateRange', () => {
    it('should call repository with date range', async () => {
      const mockNotes = [{ id: 'note-1', title: 'Note 1' }];
      mockNoteRepo.findByDateRange.mockResolvedValue(mockNotes);

      const handler = registeredHandlers.get('search:byDateRange');
      const result = await handler(
        {},
        { start_date: Date.now(), end_date: Date.now() },
      );

      expect(result.success).toBe(true);
      expect(mockNoteRepo.findByDateRange).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date),
        'updatedAt',
      );
    });

    it('should use createdAt when field=created', async () => {
      mockNoteRepo.findByDateRange.mockResolvedValue([]);

      const handler = registeredHandlers.get('search:byDateRange');
      await handler(
        {},
        { start_date: Date.now(), end_date: Date.now(), field: 'created' },
      );

      expect(mockNoteRepo.findByDateRange).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date),
        'createdAt',
      );
    });
  });
});
