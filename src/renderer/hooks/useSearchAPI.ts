/**
 * Search API Hook - React hooks for search operations
 */

import { useCallback, useState } from 'react';
import { invokeIpc } from '@renderer/lib/ipc';
import { SEARCH_CHANNELS } from '@shared/constants/ipcChannels';
import { Note } from '@shared/types';

interface SearchResult {
  id: string;
  title: string;
  notebookId: string | null;
  relevance?: number;
  similarity?: number;
  score?: number;
  title_highlight?: string;
  search_type?: 'fts' | 'semantic' | 'hybrid';
  createdAt: number;
}

interface SearchResults {
  results: SearchResult[];
  total: number;
  query_time_ms: number;
}

export function useSearchAPI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullTextSearch = useCallback(
    async (
      query: string,
      filters?: { notebookId?: string; tagIds?: string[]; limit?: number },
    ): Promise<SearchResults | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await invokeIpc<SearchResults>(SEARCH_CHANNELS.FULL_TEXT, {
          query,
          ...filters,
        });
        if (response.success && response.data) {
          return response.data;
        } else {
          setError(response.error?.message || 'Search failed');
          return null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const semanticSearch = useCallback(
    async (
      query: string,
      filters?: { notebookId?: string; threshold?: number; limit?: number },
    ): Promise<SearchResults | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await invokeIpc<SearchResults>(SEARCH_CHANNELS.SEMANTIC, {
          query,
          ...filters,
        });
        if (response.success && response.data) {
          return response.data;
        } else {
          setError(response.error?.message || 'Search failed');
          return null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const hybridSearch = useCallback(
    async (
      query: string,
      filters?: {
        notebookId?: string;
        tagIds?: string[];
        weights?: { fts: number; semantic: number };
        limit?: number;
      },
    ): Promise<SearchResults | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await invokeIpc<SearchResults>(SEARCH_CHANNELS.HYBRID, {
          query,
          ...filters,
        });
        if (response.success && response.data) {
          return response.data;
        } else {
          setError(response.error?.message || 'Search failed');
          return null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const searchByTag = useCallback(
    async (
      tagIds: string[],
      matchAll = false,
    ): Promise<{ notes: Note[]; total: number } | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await invokeIpc<{ notes: Note[]; total: number }>(SEARCH_CHANNELS.BY_TAG, {
          tagIds: tagIds,
          match_all: matchAll,
        });
        if (response.success && response.data) {
          return response.data;
        } else {
          setError(response.error?.message || 'Search failed');
          return null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const searchByDateRange = useCallback(
    async (
      startDate: number,
      endDate: number,
      field: 'created' | 'updated' = 'updated',
    ): Promise<{ notes: Note[]; total: number } | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await invokeIpc<{ notes: Note[]; total: number }>(
          SEARCH_CHANNELS.BY_DATE_RANGE,
          {
            start_date: startDate,
            end_date: endDate,
            field,
          },
        );
        if (response.success && response.data) {
          return response.data;
        } else {
          setError(response.error?.message || 'Search failed');
          return null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    fullTextSearch,
    semanticSearch,
    hybridSearch,
    searchByTag,
    searchByDateRange,
    loading,
    error,
  };
}
