/**
 * Search Use Cases Port (Inbound)
 *
 * Defines what the application CAN DO for search.
 * Implementations live in the application layer.
 */

import type { NoteProps } from '../../entities';
import type { SearchResult } from '../out/ISearchEngine';

// =============================================================================
// Requests / Responses
// =============================================================================

export interface FullTextSearchRequest {
  query: string;
  workspaceId?: string;
  limit?: number;
}

export interface FullTextSearchResponse {
  results: SearchResult[];
  total: number;
}

export interface SemanticSearchRequest {
  query: string;
  workspaceId?: string;
  limit?: number;
}

export interface VectorSearchResult {
  noteId: string;
  title: string;
  distance: number;
}

export interface SemanticSearchResponse {
  results: VectorSearchResult[];
}

export interface FindSimilarNotesRequest {
  noteId: string;
  limit?: number;
}

export interface FindSimilarNotesResponse {
  results: VectorSearchResult[];
}

export interface HybridSearchRequest {
  query: string;
  weights?: { fts: number; semantic: number };
  limit?: number;
  workspaceId?: string;
  notebookId?: string;
  tagIds?: string[];
}

export interface HybridSearchResponse {
  results: Array<{ note: NoteProps; score: number; searchType: 'fts' | 'semantic' | 'hybrid' }>;
  total: number;
  queryTimeMs: number;
}

export interface SearchByTagsRequest {
  tagIds: string[];
  matchAll?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchByTagsResponse {
  notes: NoteProps[];
  total: number;
}

export interface SearchByDateRangeRequest {
  startDate: number;
  endDate: number;
  workspaceId?: string;
  field?: 'created' | 'updated';
  limit?: number;
}

export interface SearchByDateRangeResponse {
  notes: NoteProps[];
  total: number;
}

// =============================================================================
// Use Case Interfaces
// =============================================================================

export interface IFullTextSearchUseCase {
  execute(request: FullTextSearchRequest): Promise<FullTextSearchResponse>;
}

export interface ISemanticSearchUseCase {
  execute(request: SemanticSearchRequest): Promise<SemanticSearchResponse>;
}

export interface IFindSimilarNotesUseCase {
  execute(request: FindSimilarNotesRequest): Promise<FindSimilarNotesResponse>;
}

export interface IRebuildSearchIndexUseCase {
  execute(): Promise<void>;
}

export interface IHybridSearchUseCase {
  execute(request: HybridSearchRequest): Promise<HybridSearchResponse>;
}

export interface ISearchByTagsUseCase {
  execute(request: SearchByTagsRequest): Promise<SearchByTagsResponse>;
}

export interface ISearchByDateRangeUseCase {
  execute(request: SearchByDateRangeRequest): Promise<SearchByDateRangeResponse>;
}

/**
 * Aggregated Search Use Cases (for DI container)
 */
export interface ISearchUseCases {
  fullTextSearch: IFullTextSearchUseCase;
  semanticSearch: ISemanticSearchUseCase;
  findSimilarNotes: IFindSimilarNotesUseCase;
  rebuildIndex: IRebuildSearchIndexUseCase;
  hybridSearch: IHybridSearchUseCase;
  searchByTags: ISearchByTagsUseCase;
  searchByDateRange: ISearchByDateRangeUseCase;
}

