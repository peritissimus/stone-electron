/**
 * SearchService Tests
 *
 * Covers full-text, title-only, semantic, and similarity search flows.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const loggerSpies = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../src/main/utils/logger', () => ({
  logger: loggerSpies,
}));

const mockNoteRepo = vi.hoisted(() => ({
  findAll: vi.fn(),
  getEmbedding: vi.fn(),
  findBySimilarity: vi.fn(),
}));

const mockNoteService = vi.hoisted(() => ({
  getContent: vi.fn(),
}));

const mockTopicService = vi.hoisted(() => ({
  isReady: vi.fn(),
  initialize: vi.fn(),
  semanticSearch: vi.fn(),
}));

vi.mock('../../src/main/repositories', () => ({
  getRepositories: vi.fn(() => ({
    note: mockNoteRepo,
  })),
}));

vi.mock('../../src/main/services/NoteService', () => ({
  getNoteService: vi.fn(() => mockNoteService),
}));

vi.mock('../../src/main/services/TopicService', () => ({
  getTopicService: vi.fn(() => mockTopicService),
}));

import { getSearchService } from '../../src/main/services/SearchService';

describe('SearchService', () => {
  const searchService = getSearchService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finds matches in titles and content', async () => {
    mockNoteRepo.findAll.mockResolvedValue([
      { id: '1', title: 'Hello World', filePath: null, workspaceId: null },
      { id: '2', title: 'Other', filePath: 'n.md', workspaceId: 'ws' },
    ]);
    mockNoteService.getContent.mockResolvedValue('<p>hello there</p>');

    const results = await searchService.searchFullText('hello', 5);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ note: { id: '1' }, matchType: 'title' });
    expect(results[1]).toMatchObject({ note: { id: '2' }, matchType: 'content' });
  });

  it('searchFullText ignores errors when reading content', async () => {
    mockNoteRepo.findAll.mockResolvedValue([
      { id: 'err', title: 'Other', filePath: 'broken.md', workspaceId: 'ws' },
    ]);
    mockNoteService.getContent.mockRejectedValue(new Error('boom'));

    const results = await searchService.searchFullText('broken');

    expect(results).toHaveLength(0);
    expect(loggerSpies.debug).toHaveBeenCalledWith(
      expect.stringContaining('err'),
      expect.any(Error),
    );
  });

  it('searchByTitle filters and limits results', async () => {
    mockNoteRepo.findAll.mockResolvedValue([
      { id: '1', title: 'Match me', isDeleted: false, updatedAt: new Date() },
      { id: '2', title: 'Nope', isDeleted: false, updatedAt: new Date() },
      { id: '3', title: 'Match me again', isDeleted: false, updatedAt: new Date() },
    ]);

    const results = await searchService.searchByTitle('match', 1);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
  });

  it('semanticSearch initializes topic service when not ready', async () => {
    mockTopicService.isReady.mockReturnValue(false);
    mockTopicService.initialize.mockResolvedValue(undefined);
    mockTopicService.semanticSearch.mockResolvedValue([{ noteId: '1', title: 'Note', distance: 0.2 }]);

    const results = await searchService.semanticSearch('query', 3);

    expect(mockTopicService.initialize).toHaveBeenCalled();
    expect(results[0].noteId).toBe('1');
  });

  it('findSimilarNotes skips when no embedding', async () => {
    mockNoteRepo.getEmbedding.mockResolvedValue(null);

    const results = await searchService.findSimilarNotes('source');

    expect(results).toEqual([]);
    expect(mockNoteRepo.findBySimilarity).not.toHaveBeenCalled();
    expect(loggerSpies.debug).toHaveBeenCalledWith(expect.stringContaining('source'));
  });

  it('findSimilarNotes filters out the source note', async () => {
    mockNoteRepo.getEmbedding.mockResolvedValue([0.1, 0.2]);
    mockNoteRepo.findBySimilarity.mockResolvedValue([
      { noteId: 'source', title: 'Self', distance: 0 },
      { noteId: 'other', title: 'Other', distance: 0.1 },
    ]);

    const results = await searchService.findSimilarNotes('source', 5);

    expect(results).toEqual([{ noteId: 'other', title: 'Other', distance: 0.1 }]);
  });
});
