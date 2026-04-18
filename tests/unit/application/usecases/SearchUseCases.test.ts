/**
 * SearchUseCases Application Layer Tests
 *
 * Tests use case orchestration with mocked OUT ports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FullTextSearchUseCase,
  SemanticSearchUseCase,
  FindSimilarNotesUseCase,
  RebuildSearchIndexUseCase,
  HybridSearchUseCase,
  SearchByTagsUseCase,
  SearchByDateRangeUseCase,
} from '../../../../src/main/application/usecases/SearchUseCases';
import type { INoteRepository } from '../../../../src/main/domain/ports/out/INoteRepository';
import type { ISearchEngine } from '../../../../src/main/domain/ports/out/ISearchEngine';
import type { IEmbedder } from '../../../../src/main/domain/ports/out/IEmbedder';
import type { NoteProps } from '../../../../src/main/domain/entities/Note';

// Mock factories
function createMockNoteRepository(): INoteRepository {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    findByNotebookId: vi.fn(),
    findByWorkspaceId: vi.fn(),
    findByFilePath: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    searchByTitle: vi.fn(),
    count: vi.fn(),
    exists: vi.fn(),
    findRecentlyUpdated: vi.fn(),
    findFavorites: vi.fn(),
    findPinned: vi.fn(),
    findArchived: vi.fn(),
    findDeleted: vi.fn(),
    getContentById: vi.fn(),
    getEmbedding: vi.fn(),
    updateEmbedding: vi.fn(),
    findBySimilarity: vi.fn(),
  } as unknown as INoteRepository;
}

function createMockSearchEngine(): ISearchEngine {
  return {
    searchFullText: vi.fn(),
    searchSemantic: vi.fn(),
    searchHybrid: vi.fn(),
    searchByTags: vi.fn(),
    searchByDateRange: vi.fn(),
    indexNote: vi.fn(),
    removeFromIndex: vi.fn(),
    rebuildIndex: vi.fn(),
  } as unknown as ISearchEngine;
}

function createMockEmbedder(): IEmbedder {
  return {
    generateEmbedding: vi.fn(),
    isAvailable: vi.fn(),
  } as unknown as IEmbedder;
}

function createNoteProps(overrides: Partial<NoteProps> = {}): NoteProps {
  return {
    id: 'note-1',
    title: 'Test Note',
    filePath: 'test.md',
    notebookId: null,
    workspaceId: 'ws-1',
    isFavorite: false,
    isPinned: false,
    isArchived: false,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    ...overrides,
  };
}

describe('SearchUseCases', () => {
  describe('FullTextSearchUseCase', () => {
    let noteRepo: INoteRepository;
    let searchEngine: ISearchEngine;
    let useCase: FullTextSearchUseCase;

    beforeEach(() => {
      noteRepo = createMockNoteRepository();
      searchEngine = createMockSearchEngine();
      useCase = new FullTextSearchUseCase(noteRepo, searchEngine);
    });

    it('searches notes with full text', async () => {
      const searchResults = [
        { note: createNoteProps(), relevance: 1, matchType: 'content' as const },
      ];
      vi.mocked(searchEngine.searchFullText).mockResolvedValue(searchResults);

      const result = await useCase.execute({ query: 'test' });

      expect(result.results).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(searchEngine.searchFullText).toHaveBeenCalledWith('test', {
        workspaceId: undefined,
        limit: 50,
      });
    });

    it('applies workspaceId filter', async () => {
      vi.mocked(searchEngine.searchFullText).mockResolvedValue([]);

      await useCase.execute({ query: 'test', workspaceId: 'ws-1' });

      expect(searchEngine.searchFullText).toHaveBeenCalledWith('test', {
        workspaceId: 'ws-1',
        limit: 50,
      });
    });

    it('applies limit', async () => {
      vi.mocked(searchEngine.searchFullText).mockResolvedValue([]);

      await useCase.execute({ query: 'test', limit: 10 });

      expect(searchEngine.searchFullText).toHaveBeenCalledWith('test', {
        workspaceId: undefined,
        limit: 10,
      });
    });
  });

  describe('SemanticSearchUseCase', () => {
    let noteRepo: INoteRepository;
    let embeddingService: IEmbedder;
    let useCase: SemanticSearchUseCase;

    beforeEach(() => {
      noteRepo = createMockNoteRepository();
      embeddingService = createMockEmbedder();
      useCase = new SemanticSearchUseCase(noteRepo, embeddingService);
    });

    it('performs semantic search', async () => {
      const embedding = new Float32Array([0.1, 0.2, 0.3]);
      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue(embedding);
      vi.mocked(noteRepo.findBySimilarity).mockResolvedValue([
        { noteId: 'note-1', title: 'Test', distance: 0.9 },
      ]);

      const result = await useCase.execute({ query: 'test query' });

      expect(result.results).toHaveLength(1);
      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith('test query');
    });

    it('returns empty results when no embedding generated', async () => {
      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue(
        null as unknown as Float32Array,
      );

      const result = await useCase.execute({ query: 'test' });

      expect(result.results).toHaveLength(0);
    });
  });

  describe('FindSimilarNotesUseCase', () => {
    let noteRepo: INoteRepository;
    let embeddingService: IEmbedder;
    let useCase: FindSimilarNotesUseCase;

    beforeEach(() => {
      noteRepo = createMockNoteRepository();
      embeddingService = createMockEmbedder();
      useCase = new FindSimilarNotesUseCase(noteRepo, embeddingService);
    });

    it('finds similar notes', async () => {
      const embedding = [0.1, 0.2, 0.3];
      vi.mocked(noteRepo.getEmbedding).mockResolvedValue(embedding);
      vi.mocked(noteRepo.findById).mockResolvedValue(createNoteProps({ id: 'note-1' }));
      vi.mocked(noteRepo.findBySimilarity).mockResolvedValue([
        { noteId: 'note-1', title: 'Source', distance: 1.0 },
        { noteId: 'note-2', title: 'Similar', distance: 0.9 },
      ]);

      const result = await useCase.execute({ noteId: 'note-1' });

      // Should exclude source note
      expect(result.results).toHaveLength(1);
      expect(result.results[0].noteId).toBe('note-2');
    });

    it('returns empty when note has no embedding', async () => {
      vi.mocked(noteRepo.getEmbedding).mockResolvedValue(null);

      const result = await useCase.execute({ noteId: 'note-1' });

      expect(result.results).toHaveLength(0);
    });

    it('returns empty when note not found', async () => {
      vi.mocked(noteRepo.getEmbedding).mockResolvedValue([0.1, 0.2]);
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      const result = await useCase.execute({ noteId: 'nonexistent' });

      expect(result.results).toHaveLength(0);
    });
  });

  describe('RebuildSearchIndexUseCase', () => {
    let searchEngine: ISearchEngine;
    let useCase: RebuildSearchIndexUseCase;

    beforeEach(() => {
      searchEngine = createMockSearchEngine();
      useCase = new RebuildSearchIndexUseCase(searchEngine);
    });

    it('rebuilds search index', async () => {
      vi.mocked(searchEngine.rebuildIndex).mockResolvedValue(undefined);

      await useCase.execute();

      expect(searchEngine.rebuildIndex).toHaveBeenCalled();
    });
  });

  describe('HybridSearchUseCase', () => {
    let noteRepo: INoteRepository;
    let searchEngine: ISearchEngine;
    let embeddingService: IEmbedder;
    let useCase: HybridSearchUseCase;

    beforeEach(() => {
      noteRepo = createMockNoteRepository();
      searchEngine = createMockSearchEngine();
      embeddingService = createMockEmbedder();
      useCase = new HybridSearchUseCase(noteRepo, searchEngine, embeddingService);
    });

    it('performs hybrid search', async () => {
      const searchResults = [
        { note: createNoteProps(), relevance: 1, matchType: 'content' as const },
      ];
      vi.mocked(searchEngine.searchFullText).mockResolvedValue(searchResults);

      const result = await useCase.execute({ query: 'test' });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].searchType).toBe('fts');
      expect(result.queryTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('SearchByTagsUseCase', () => {
    let noteRepo: INoteRepository;
    let useCase: SearchByTagsUseCase;

    beforeEach(() => {
      noteRepo = createMockNoteRepository();
      useCase = new SearchByTagsUseCase(noteRepo);
    });

    it('returns empty results (not implemented)', async () => {
      const result = await useCase.execute({ tagIds: ['tag-1', 'tag-2'] });

      expect(result.notes).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('SearchByDateRangeUseCase', () => {
    let noteRepo: INoteRepository;
    let useCase: SearchByDateRangeUseCase;

    beforeEach(() => {
      noteRepo = createMockNoteRepository();
      useCase = new SearchByDateRangeUseCase(noteRepo);
    });

    it('searches notes by date range', async () => {
      const notes = [
        createNoteProps({ id: 'note-1', updatedAt: new Date('2024-01-15') }),
        createNoteProps({ id: 'note-2', updatedAt: new Date('2024-02-15') }),
      ];
      vi.mocked(noteRepo.findAll).mockResolvedValue(notes);

      const result = await useCase.execute({
        startDate: new Date('2024-01-01').getTime(),
        endDate: new Date('2024-01-31').getTime(),
      });

      expect(result.notes).toHaveLength(1);
      expect(result.notes[0].id).toBe('note-1');
    });

    it('filters by created date when specified', async () => {
      const notes = [
        createNoteProps({ id: 'note-1', createdAt: new Date('2024-01-15') }),
      ];
      vi.mocked(noteRepo.findAll).mockResolvedValue(notes);

      const result = await useCase.execute({
        startDate: new Date('2024-01-01').getTime(),
        endDate: new Date('2024-01-31').getTime(),
        field: 'created',
      });

      expect(result.notes).toHaveLength(1);
    });

    it('applies limit', async () => {
      const notes = [
        createNoteProps({ id: 'note-1', updatedAt: new Date('2024-01-15') }),
        createNoteProps({ id: 'note-2', updatedAt: new Date('2024-01-16') }),
      ];
      vi.mocked(noteRepo.findAll).mockResolvedValue(notes);

      const result = await useCase.execute({
        startDate: new Date('2024-01-01').getTime(),
        endDate: new Date('2024-01-31').getTime(),
        limit: 1,
      });

      expect(result.notes).toHaveLength(1);
      expect(result.total).toBe(2);
    });
  });
});
