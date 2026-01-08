/**
 * Search Use Cases Port
 *
 * Defines the contract for search operations.
 */

import type { NoteProps } from '../../entities';

// Request/Response types
export interface FullTextSearchRequest {
  query: string;
  notebookId?: string;
  tagIds?: string[];
  limit?: number;
  offset?: number;
}

export interface FullTextSearchResponse {
  results: Array<{
    note: NoteProps;
    relevance: number;
    matchType: 'title' | 'content' | 'both';
    titleHighlight?: string;
  }>;
  total: number;
  queryTimeMs: number;
}

export interface SemanticSearchRequest {
  query: string;
  threshold?: number;
  limit?: number;
  notebookId?: string;
}

export interface SemanticSearchResponse {
  results: Array<{
    noteId: string;
    title: string;
    similarity: number;
  }>;
  total: number;
  queryTimeMs: number;
}

export interface HybridSearchRequest {
  query: string;
  weights?: { fts: number; semantic: number };
  limit?: number;
  notebookId?: string;
  tagIds?: string[];
}

export interface HybridSearchResponse {
  results: Array<{
    note: NoteProps;
    score: number;
    searchType: 'fts' | 'semantic' | 'hybrid';
  }>;
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
  startDate: number; // timestamp
  endDate: number; // timestamp
  field?: 'created' | 'updated';
  limit?: number;
}

export interface SearchByDateRangeResponse {
  notes: NoteProps[];
  total: number;
}

// Use case interfaces
export interface IFullTextSearchUseCase {
  execute(request: FullTextSearchRequest): Promise<FullTextSearchResponse>;
}

export interface ISemanticSearchUseCase {
  execute(request: SemanticSearchRequest): Promise<SemanticSearchResponse>;
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
