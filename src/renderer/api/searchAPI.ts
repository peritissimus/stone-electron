/**
 * Search API - IPC channel wrappers for search operations
 *
 * Implements: specs/api.ts#SearchAPI
 * Pure functions that wrap IPC channels. No React, no stores.
 */

import { invokeIpc } from '@renderer/lib/ipc';
import { SEARCH_CHANNELS } from '@shared/constants/ipcChannels';
import type { SearchResults, IpcResponse } from '@shared/types';

export interface SearchParams {
  query: string;
  limit?: number;
  offset?: number;
}

export interface DateRangeParams {
  startDate: string;
  endDate: string;
  limit?: number;
  offset?: number;
}

export const searchAPI = {
  /**
   * Full-text search
   */
  fullText: (params: SearchParams): Promise<IpcResponse<SearchResults>> =>
    invokeIpc(SEARCH_CHANNELS.FULL_TEXT, params),

  /**
   * Semantic search using embeddings
   */
  semantic: (params: SearchParams): Promise<IpcResponse<SearchResults>> =>
    invokeIpc(SEARCH_CHANNELS.SEMANTIC, params),

  /**
   * Hybrid search (combines full-text and semantic)
   */
  hybrid: (params: SearchParams): Promise<IpcResponse<SearchResults>> =>
    invokeIpc(SEARCH_CHANNELS.HYBRID, params),

  /**
   * Search by tag
   */
  byTag: (
    tagId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<IpcResponse<SearchResults>> =>
    invokeIpc(SEARCH_CHANNELS.BY_TAG, { tagId, ...options }),

  /**
   * Search by date range
   */
  byDateRange: (params: DateRangeParams): Promise<IpcResponse<SearchResults>> =>
    invokeIpc(SEARCH_CHANNELS.BY_DATE_RANGE, params),
};
