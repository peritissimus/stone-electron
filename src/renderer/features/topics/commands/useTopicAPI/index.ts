/**
 * Topic commands — everything the renderer may ask of the semantic index.
 *
 * Topics are organized in the main process, so there is no create/assign/
 * classify surface here: the renderer warms the embedder, reads index status,
 * and searches by meaning.
 */

import { useCallback } from 'react';
import { useTopicStore } from '@renderer/features/topics/model/topicStore';
import { topicAPI } from '@renderer/api';
import { handleIpcResponse } from '@renderer/lib/ipc';

export function useTopicAPI() {
  const setEmbeddingStatus = useTopicStore((state) => state.setEmbeddingStatus);
  const setSearchResults = useTopicStore((state) => state.setSearchResults);
  const setLoading = useTopicStore((state) => state.setLoading);
  const setError = useTopicStore((state) => state.setError);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await topicAPI.initialize();
      const result = handleIpcResponse(response, 'Failed to initialize embedding service');
      if (result.success) return result.data.ready;
      setError(result.error);
      return false;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to initialize embedding service');
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  const getEmbeddingStatus = useCallback(async () => {
    setError(null);
    try {
      const response = await topicAPI.getEmbeddingStatus();
      const result = handleIpcResponse(response, 'Failed to get embedding status');
      if (result.success) {
        setEmbeddingStatus(result.data);
        return result.data;
      }
      setError(result.error);
      return null;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to get embedding status');
      return null;
    }
  }, [setEmbeddingStatus, setError]);

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

  return { initialize, getEmbeddingStatus, semanticSearch };
}
