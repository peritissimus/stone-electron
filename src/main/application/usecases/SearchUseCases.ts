/**
 * Search Use Cases
 *
 * Application layer implementations for search operations.
 */

import {
  type INoteRepository,
  type ISearchEngine,
  type IEmbeddingService,
  type ISearchUseCases,
  type IFullTextSearchUseCase,
  type ISemanticSearchUseCase,
  type IFindSimilarNotesUseCase,
  type IRebuildSearchIndexUseCase,
  type IHybridSearchUseCase,
  type ISearchByTagsUseCase,
  type ISearchByDateRangeUseCase,
  type FullTextSearchRequest,
  type FullTextSearchResponse,
  type SemanticSearchRequest,
  type SemanticSearchResponse,
  type FindSimilarNotesRequest,
  type FindSimilarNotesResponse,
  type HybridSearchRequest,
  type HybridSearchResponse,
  type SearchByTagsRequest,
  type SearchByTagsResponse,
  type SearchByDateRangeRequest,
  type SearchByDateRangeResponse,
} from '../../domain';

// ============================================================================
// Use Case Implementations
// ============================================================================

export class FullTextSearchUseCase implements IFullTextSearchUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly searchEngine: ISearchEngine,
  ) {}

  async execute(request: FullTextSearchRequest): Promise<FullTextSearchResponse> {
    const results = await this.searchEngine.searchFullText(request.query, {
      workspaceId: request.workspaceId,
      limit: request.limit || 50,
    });

    return { results, total: results.length };
  }
}

export class SemanticSearchUseCase implements ISemanticSearchUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly embeddingService: IEmbeddingService,
  ) {}

  async execute(request: SemanticSearchRequest): Promise<SemanticSearchResponse> {
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

export class FindSimilarNotesUseCase implements IFindSimilarNotesUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly embeddingService: IEmbeddingService,
  ) {}

  async execute(request: FindSimilarNotesRequest): Promise<FindSimilarNotesResponse> {
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

export class RebuildSearchIndexUseCase implements IRebuildSearchIndexUseCase {
  constructor(private readonly searchEngine: ISearchEngine) {}

  async execute(): Promise<void> {
    await this.searchEngine.rebuildIndex();
  }
}

export class HybridSearchUseCase implements IHybridSearchUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly searchEngine: ISearchEngine,
    private readonly embeddingService: IEmbeddingService,
  ) {}

  async execute(request: HybridSearchRequest): Promise<HybridSearchResponse> {
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

export class SearchByTagsUseCase implements ISearchByTagsUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(request: SearchByTagsRequest): Promise<SearchByTagsResponse> {
    // NOTE: Tag filtering requires a tag repository - for now return empty
    // TODO: Implement when ITagRepository is available in use case deps
    const notes: SearchByTagsResponse['notes'] = [];

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

export class SearchByDateRangeUseCase implements ISearchByDateRangeUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(request: SearchByDateRangeRequest): Promise<SearchByDateRangeResponse> {
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
