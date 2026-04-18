import { useCallback } from 'react';
import { useTopicStore } from '@renderer/stores/topicStore';
import { topicAPI } from '@renderer/api';
import { handleIpcResponse } from '@renderer/lib/ipc';

export function useTopicSearch() {
  const { setSearchResults, setLoading, setError } = useTopicStore();

  const semanticSearch = useCallback(
    async (query: string, limit = 10) => {
      setLoading(true);
      setError(null);
      try {
        const response = await topicAPI.semanticSearch(query, limit);
        const result = handleIpcResponse(response, 'Failed to perform semantic search');
        if (result.success) {
          setSearchResults(result.data.results);
          return result.data.results;
        }
        setError(result.error);
        return [];
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to perform semantic search');
        return [];
      } finally {
        setLoading(false);
      }
    },
    [setSearchResults, setLoading, setError],
  );

  const findSimilarNotes = useCallback(
    async (noteId: string, limit = 5) => {
      setError(null);
      try {
        const response = await topicAPI.getSimilarNotes(noteId, limit);
        const result = handleIpcResponse(response, 'Failed to find similar notes');
        return result.success ? result.data.similar : [];
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to find similar notes');
        return [];
      }
    },
    [setError],
  );

  return {
    semanticSearch,
    findSimilarNotes,
  };
}
