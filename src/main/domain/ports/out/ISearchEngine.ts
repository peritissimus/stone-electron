/**
 * Search Engine Port
 *
 * Defines the contract for search operations.
 */

import type { NoteProps } from '../../entities';

export interface SearchResult {
  note: NoteProps;
  relevance: number;
  matchType: 'title' | 'content' | 'both';
  highlights?: {
    title?: string;
    content?: string;
  };
}

export interface SemanticSearchResult {
  noteId: string;
  title: string;
  similarity: number;
  distance: number;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  notebookId?: string;
  tagIds?: string[];
  workspaceId?: string;
  excludeDeleted?: boolean;
}

export interface DateRangeOptions {
  startDate: Date;
  endDate: Date;
  workspaceId?: string;
  field?: 'created' | 'updated';
  limit?: number;
}

export interface ISearchEngine {
  /**
   * Full-text search across notes
   */
  searchFullText(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Semantic search using embeddings
   */
  searchSemantic(query: string, options?: SearchOptions): Promise<SemanticSearchResult[]>;

  /**
   * Hybrid search (FTS + semantic)
   */
  searchHybrid(
    query: string,
    options?: SearchOptions & { weights?: { fts: number; semantic: number } },
  ): Promise<SearchResult[]>;

  /**
   * Search by tags
   */
  searchByTags(
    tagIds: string[],
    options?: SearchOptions & { matchAll?: boolean },
  ): Promise<NoteProps[]>;

  /**
   * Search by date range
   */
  searchByDateRange(options: DateRangeOptions): Promise<NoteProps[]>;

  /**
   * Update search index for a note
   */
  indexNote(noteId: string, title: string, content: string): Promise<void>;

  /**
   * Remove note from search index
   */
  removeFromIndex(noteId: string): Promise<void>;

  /**
   * Rebuild search index
   */
  rebuildIndex(): Promise<void>;
}
