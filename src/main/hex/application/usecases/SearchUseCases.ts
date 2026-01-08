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
    private readonly searchEngine: ISearchEngine
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
    private readonly embeddingService: IEmbeddingService
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
      request.limit || 10
    );

    return { results };
  }
}

export class FindSimilarNotesUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly embeddingService: IEmbeddingService
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

    // Find similar notes (excluding the source note)
    const allResults = await this.noteRepository.findBySimilarity(
      embedding,
      (request.limit || 5) + 1
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

// ============================================================================
// Factory
// ============================================================================

export interface ISearchUseCases {
  fullTextSearch: FullTextSearchUseCase;
  semanticSearch: SemanticSearchUseCase;
  findSimilarNotes: FindSimilarNotesUseCase;
  rebuildIndex: RebuildSearchIndexUseCase;
}

export function createSearchUseCases(
  noteRepository: INoteRepository,
  searchEngine: ISearchEngine,
  embeddingService: IEmbeddingService
): ISearchUseCases {
  return {
    fullTextSearch: new FullTextSearchUseCase(noteRepository, searchEngine),
    semanticSearch: new SemanticSearchUseCase(noteRepository, embeddingService),
    findSimilarNotes: new FindSimilarNotesUseCase(noteRepository, embeddingService),
    rebuildIndex: new RebuildSearchIndexUseCase(searchEngine),
  };
}
