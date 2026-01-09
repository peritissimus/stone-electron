/**
 * Search Use Cases
 *
 * Application layer implementations for search operations.
 */

import {
  type NoteProps,
  type INoteRepository,
  type ISearchEngine,
  type IEmbeddingService,
  type SearchResult,
  type SemanticSearchResult,
} from '../../domain';

// ============================================================================
// Use Case Implementations
// ============================================================================

export class FullTextSearchUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly searchEngine: ISearchEngine,
  ) {}

  async execute(request: {
    query: string;
    workspaceId?: string;
    limit?: number;
  }): Promise<{ results: SearchResult[]; total: number }> {
    const results = await this.searchEngine.searchFullText(request.query, {
      workspaceId: request.workspaceId,
      limit: request.limit || 50,
    });

    return { results, total: results.length };
  }
}

export class SemanticSearchUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly embeddingService: IEmbeddingService,
  ) {}

  async execute(request: {
    query: string;
    workspaceId?: string;
    limit?: number;
  }): Promise<{ results: Array<{ noteId: string; title: string; distance: number }> }> {
    // Generate embedding for query
    const queryEmbedding = await this.embeddingService.generateEmbedding(request.query);

    if (!queryEmbedding) {
      return { results: [] };
    }

    // Convert Float32Array to number[]
    const embeddingArray = Array.from(queryEmbedding);

    // Find similar notes
    const results = await this.noteRepository.findBySimilarity(
      embeddingArray,
      request.limit || 10,
      request.workspaceId,
    );

    return { results };
  }
}

export class FindSimilarNotesUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly embeddingService: IEmbeddingService,
  ) {}

  async execute(request: {
    noteId: string;
    limit?: number;
  }): Promise<{ results: Array<{ noteId: string; title: string; distance: number }> }> {
    // Get note's embedding
    const embedding = await this.noteRepository.getEmbedding(request.noteId);

    if (!embedding) {
      return { results: [] };
    }

    // Get note to find its workspace
    const note = await this.noteRepository.findById(request.noteId);
    if (!note) {
      return { results: [] };
    }

    // Find similar notes (excluding the source note)
    const allResults = await this.noteRepository.findBySimilarity(
      embedding,
      (request.limit || 5) + 1,
      note.workspaceId || undefined,
    );

    const results = allResults
      .filter((r) => r.noteId !== request.noteId)
      .slice(0, request.limit || 5);

    return { results };
  }
}

export class RebuildSearchIndexUseCase {
  constructor(private readonly searchEngine: ISearchEngine) {}

  async execute(): Promise<void> {
    await this.searchEngine.rebuildIndex();
  }
}

export class HybridSearchUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly searchEngine: ISearchEngine,
    private readonly embeddingService: IEmbeddingService,
  ) {}

  async execute(request: {
    query: string;
    weights?: { fts: number; semantic: number };
    limit?: number;
    workspaceId?: string;
    notebookId?: string;
    tagIds?: string[];
  }): Promise<{
    results: Array<{ note: NoteProps; score: number; searchType: 'fts' | 'semantic' | 'hybrid' }>;
    total: number;
    queryTimeMs: number;
  }> {
    const startTime = Date.now();
    const limit = request.limit || 50;

    // Use full-text search as primary (can be enhanced with semantic later)
    const ftsResults = await this.searchEngine.searchFullText(request.query, {
      workspaceId: request.workspaceId,
      limit,
    });

    const queryTimeMs = Date.now() - startTime;

    return {
      results: ftsResults.map((r) => ({
        note: r.note,
        score: 1,
        searchType: 'fts' as const,
      })),
      total: ftsResults.length,
      queryTimeMs,
    };
  }
}

export class SearchByTagsUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(request: {
    tagIds: string[];
    matchAll?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ notes: NoteProps[]; total: number }> {
    // NOTE: Tag filtering requires a tag repository - for now return empty
    // TODO: Implement when ITagRepository is available in use case deps
    const notes: NoteProps[] = [];

    // Apply pagination
    const offset = request.offset || 0;
    const limit = request.limit || notes.length;
    const paginatedNotes = notes.slice(offset, offset + limit);

    return {
      notes: paginatedNotes,
      total: notes.length,
    };
  }
}

export class SearchByDateRangeUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(request: {
    startDate: number;
    endDate: number;
    workspaceId?: string;
    field?: 'created' | 'updated';
    limit?: number;
  }): Promise<{ notes: NoteProps[]; total: number }> {
    const field = request.field === 'created' ? 'createdAt' : 'updatedAt';
    const orderBy = field;
    const startDate = new Date(request.startDate);
    const endDate = new Date(request.endDate);

    // Get all notes for workspace and filter by date range
    const allNotes = await this.noteRepository.findAll({
      workspaceId: request.workspaceId,
      isDeleted: false,
      orderBy,
      orderDirection: 'desc',
    });

    const filteredNotes = allNotes.filter((note) => {
      const noteDate = note[field];
      return noteDate >= startDate && noteDate <= endDate;
    });

    const limitedNotes = request.limit ? filteredNotes.slice(0, request.limit) : filteredNotes;

    return {
      notes: limitedNotes,
      total: filteredNotes.length,
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

export interface ISearchUseCases {
  fullTextSearch: FullTextSearchUseCase;
  semanticSearch: SemanticSearchUseCase;
  findSimilarNotes: FindSimilarNotesUseCase;
  rebuildIndex: RebuildSearchIndexUseCase;
  hybridSearch: HybridSearchUseCase;
  searchByTags: SearchByTagsUseCase;
  searchByDateRange: SearchByDateRangeUseCase;
}

export function createSearchUseCases(
  noteRepository: INoteRepository,
  searchEngine: ISearchEngine,
  embeddingService: IEmbeddingService,
): ISearchUseCases {
  return {
    fullTextSearch: new FullTextSearchUseCase(noteRepository, searchEngine),
    semanticSearch: new SemanticSearchUseCase(noteRepository, embeddingService),
    findSimilarNotes: new FindSimilarNotesUseCase(noteRepository, embeddingService),
    rebuildIndex: new RebuildSearchIndexUseCase(searchEngine),
    hybridSearch: new HybridSearchUseCase(noteRepository, searchEngine, embeddingService),
    searchByTags: new SearchByTagsUseCase(noteRepository),
    searchByDateRange: new SearchByDateRangeUseCase(noteRepository),
  };
}
