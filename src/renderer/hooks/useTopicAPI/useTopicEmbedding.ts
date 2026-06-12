import { useCallback } from 'react';
import { useTopicStore } from '@renderer/stores/topicStore';
import { topicAPI } from '@renderer/api';
import { handleIpcResponse } from '@renderer/lib/ipc';

interface Options {
  reloadTopics: () => Promise<unknown>;
}

export function useTopicEmbedding({ reloadTopics }: Options) {
  const { setEmbeddingStatus, setLoading, setClassifying, setError } = useTopicStore();

  const initialize = useCallback(async () => {
    console.log('[TopicAPI] Initializing embedding service...');
    setLoading(true);
    setError(null);
    try {
      const response = await topicAPI.initialize();
      console.log('[TopicAPI] Initialize response:', response);
      const result = handleIpcResponse(response, 'Failed to initialize embedding service');
      if (result.success) {
        console.log('[TopicAPI] Initialize result:', { success: true, ready: result.data.ready });
        return result.data.ready;
      }
      console.log('[TopicAPI] Initialize failed:', result.error);
      return false;
    } catch (error) {
      console.error('[TopicAPI] Initialize error:', error);
      setError(error instanceof Error ? error.message : 'Failed to initialize embedding service');
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  const classifyNote = useCallback(
    async (noteId: string) => {
      console.log('[TopicAPI] Classifying note:', noteId);
      setClassifying(true);
      setError(null);
      try {
        const response = await topicAPI.classifyNote(noteId);
        console.log('[TopicAPI] Classify note response:', response);
        const result = handleIpcResponse(response, 'Failed to classify note');
        if (result.success) {
          console.log('[TopicAPI] Classify note result:', result.data.topics);
          return result.data.topics;
        }
        console.log('[TopicAPI] Classify note failed:', result.error);
        return [];
      } catch (error) {
        console.error('[TopicAPI] Classify note error:', error);
        setError(error instanceof Error ? error.message : 'Failed to classify note');
        return [];
      } finally {
        setClassifying(false);
      }
    },
    [setClassifying, setError],
  );

  const classifyAllNotes = useCallback(
    async (options?: { excludeJournal?: boolean }) => {
      console.log('[TopicAPI] Classifying all notes...', options);
      setClassifying(true);
      setError(null);
      try {
        const response = await topicAPI.classifyAll(options);
        console.log('[TopicAPI] Classify all response:', response);
        const result = handleIpcResponse(response, 'Failed to classify notes');
        if (result.success) {
          console.log('[TopicAPI] Classify all result:', result.data);
          await reloadTopics();
          return result.data;
        }
        console.error('[TopicAPI] Classify all error:', result.error);
        setError(result.error);
        return null;
      } catch (error) {
        console.error('[TopicAPI] Classify all exception:', error);
        setError(error instanceof Error ? error.message : 'Failed to classify notes');
        return null;
      } finally {
        setClassifying(false);
      }
    },
    [reloadTopics, setClassifying, setError],
  );

  const reclassifyAllNotes = useCallback(
    async (options?: { excludeJournal?: boolean }) => {
      console.log('[TopicAPI] Reclassifying all notes (force)...', options);
      setClassifying(true);
      setError(null);
      try {
        const response = await topicAPI.reclassifyAll(options);
        console.log('[TopicAPI] Reclassify all response:', response);
        const result = handleIpcResponse(response, 'Failed to reclassify notes');
        if (result.success) {
          console.log('[TopicAPI] Reclassify all result:', result.data);
          await reloadTopics();
          return result.data;
        }
        console.error('[TopicAPI] Reclassify all error:', result.error);
        setError(result.error);
        return null;
      } catch (error) {
        console.error('[TopicAPI] Reclassify all exception:', error);
        setError(error instanceof Error ? error.message : 'Failed to reclassify notes');
        return null;
      } finally {
        setClassifying(false);
      }
    },
    [reloadTopics, setClassifying, setError],
  );

  const getEmbeddingStatus = useCallback(async () => {
    console.log('[TopicAPI] Getting embedding status...');
    setError(null);
    try {
      const response = await topicAPI.getEmbeddingStatus();
      console.log('[TopicAPI] Embedding status response:', response);
      const result = handleIpcResponse(response, 'Failed to get embedding status');
      if (result.success) {
        console.log('[TopicAPI] Embedding status:', result.data);
        setEmbeddingStatus(result.data);
        return result.data;
      }
      console.error('[TopicAPI] Embedding status error:', result.error);
      setError(result.error);
      return null;
    } catch (error) {
      console.error('[TopicAPI] Embedding status exception:', error);
      setError(error instanceof Error ? error.message : 'Failed to get embedding status');
      return null;
    }
  }, [setEmbeddingStatus, setError]);

  const recomputeCentroids = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await topicAPI.recomputeCentroids();
      return response.success;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to recompute centroids');
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  return {
    initialize,
    classifyNote,
    classifyAllNotes,
    reclassifyAllNotes,
    getEmbeddingStatus,
    recomputeCentroids,
  };
}
