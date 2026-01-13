/**
 * Search API - IPC channel wrappers for search operations
 *
 * Implements: specs/api.ts#SearchAPI
 * Pure functions that wrap IPC channels. No React, no stores.
 */

import { invokeIpc } from '@renderer/lib/ipc';
import { SEARCH_CHANNELS } from '@shared/constants/ipcChannels';
import type { SearchResults, IpcResponse } from '@shared/types';
import { validateResponse } from './validation';
import { SearchResultsSchema } from './schemas';

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
  fullText: async (params: SearchParams): Promise<IpcResponse<SearchResults>> => {
    const response = await invokeIpc(SEARCH_CHANNELS.FULL_TEXT, params);
    return validateResponse(response, SearchResultsSchema);
  },

  /**
   * Semantic search using embeddings
   */
  semantic: async (params: SearchParams): Promise<IpcResponse<SearchResults>> => {
    const response = await invokeIpc(SEARCH_CHANNELS.SEMANTIC, params);
    return validateResponse(response, SearchResultsSchema);
  },

  /**
   * Hybrid search (combines full-text and semantic)
   */
  hybrid: async (params: SearchParams): Promise<IpcResponse<SearchResults>> => {
    const response = await invokeIpc(SEARCH_CHANNELS.HYBRID, params);
    return validateResponse(response, SearchResultsSchema);
  },

  /**
   * Search by tag
   */
  byTag: async (
    tagId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<IpcResponse<SearchResults>> => {
    const response = await invokeIpc(SEARCH_CHANNELS.BY_TAG, { tagId, ...options });
    return validateResponse(response, SearchResultsSchema);
  },

  /**
   * Search by date range
   */
  byDateRange: async (params: DateRangeParams): Promise<IpcResponse<SearchResults>> => {
    const response = await invokeIpc(SEARCH_CHANNELS.BY_DATE_RANGE, params);
    return validateResponse(response, SearchResultsSchema);
  },
};
