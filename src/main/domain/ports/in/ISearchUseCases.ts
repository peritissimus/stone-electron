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

export interface HybridSearchChunkHit {
  chunkId: string;
  noteId: string;
  /** Hierarchical heading context for the matched chunk. */
  headingPath: string[];
  /** Snippet of the chunk's text — already trimmed for display. */
  excerpt: string;
  /** Combined RRF score, higher = better. */
  score: number;
  /** Which retrieval halves contributed to this chunk. */
  sources: Array<'fts' | 'semantic'>;
}

export interface HybridSearchResultRow {
  note: NoteProps;
  /** Aggregated note-level score from this note's best chunks. */
  score: number;
  searchType: 'fts' | 'semantic' | 'hybrid';
  /**
   * Chunks from this note that contributed, best-first. Available when the
   * retrieval pipeline has chunk-level data (i.e. notes that have been
   * indexed through IndexNoteUseCase). Empty for legacy note-level results.
   */
  chunks?: HybridSearchChunkHit[];
}

export interface HybridSearchResponse {
  results: HybridSearchResultRow[];
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

// --- Related Notes (per-note discovery in the editor sidecar) ---

export interface GetRelatedNotesRequest {
  noteId: string;
  limit?: number;
  workspaceId?: string;
}

export interface RelatedNoteMatch {
  noteId: string;
  title: string;
  /**
   * Calibrated relatedness in [0, 1] — chunk-alignment semantics plus
   * tag/link-graph/notebook boosts. Safe to render as a percentage.
   */
  similarity: number;
  /** How many of this note's chunks align strongly with the source note. */
  matchedChunks: number;
  bestChunk: {
    chunkId: string;
    headingPath: string[];
    excerpt: string;
  };
}

export interface GetRelatedNotesResponse {
  results: RelatedNoteMatch[];
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

export interface IHybridSearchUseCase {
  execute(request: HybridSearchRequest): Promise<HybridSearchResponse>;
}

export interface ISearchByTagsUseCase {
  execute(request: SearchByTagsRequest): Promise<SearchByTagsResponse>;
}

export interface ISearchByDateRangeUseCase {
  execute(request: SearchByDateRangeRequest): Promise<SearchByDateRangeResponse>;
}

export interface IGetRelatedNotesUseCase {
  execute(request: GetRelatedNotesRequest): Promise<GetRelatedNotesResponse>;
}

/**
 * Aggregated Search Use Cases (for DI container)
 */
export interface ISearchUseCases {
  fullTextSearch: IFullTextSearchUseCase;
  semanticSearch: ISemanticSearchUseCase;
  findSimilarNotes: IFindSimilarNotesUseCase;
  hybridSearch: IHybridSearchUseCase;
  searchByTags: ISearchByTagsUseCase;
  searchByDateRange: ISearchByDateRangeUseCase;
  getRelatedNotes: IGetRelatedNotesUseCase;
}

