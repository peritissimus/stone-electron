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
   * Title-prefix search across notes (cheap LIKE). For body search use the
   * chunk-level IIndexRepository.searchFullText instead.
   */
  searchFullText(query: string, options?: SearchOptions): Promise<SearchResult[]>;

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
}
