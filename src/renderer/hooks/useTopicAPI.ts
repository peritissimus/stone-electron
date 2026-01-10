/**
 * Topic API Hook - React hooks for topic and semantic search operations
 *
 * Uses createEntityAPI for base CRUD, extends with semantic search operations.
 */

import { useCallback } from 'react';
import { useTopicStore } from '@renderer/stores/topicStore';
import type { TopicWithCount } from '@shared/types';
import { TOPIC_CHANNELS } from '@shared/constants/ipcChannels';
import { createEntityAPI } from './createEntityAPI';
import { topicAPI } from '@renderer/api';
import { handleIpcResponse } from '@renderer/lib/ipc';

/**
 * Base CRUD operations from factory
 */
const useTopicCRUD = createEntityAPI<TopicWithCount>({
  entityName: 'topic',
  channels: {
    GET_ALL: TOPIC_CHANNELS.GET_ALL,
    CREATE: TOPIC_CHANNELS.CREATE,
    UPDATE: TOPIC_CHANNELS.UPDATE,
    DELETE: TOPIC_CHANNELS.DELETE,
  },
  useStore: () => {
    const store = useTopicStore();
    return {
      setItems: store.setTopics,
      addItem: store.addTopic,
      updateItem: (topic: TopicWithCount) => store.updateTopic(topic.id, topic),
      deleteItem: store.deleteTopic,
      setLoading: store.setLoading,
      setError: store.setError,
    };
  },
  responseKey: 'topics',
  logPrefix: '[TopicAPI]',
});

/**
 * Topic API hook with CRUD + semantic search operations
 */
export function useTopicAPI() {
  const { loadAll, create, update, remove } = useTopicCRUD();
  const { setEmbeddingStatus, setSearchResults, setLoading, setClassifying, setError } =
    useTopicStore();

  /**
   * Initialize the embedding service
   */
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

  /**
   * Load all topics
   */
  const loadTopics = useCallback(
    async (options?: { excludeJournal?: boolean }) => {
      console.log('[TopicAPI] Loading topics...', options);
      const result = await loadAll(options || {});
      console.log('[TopicAPI] Loaded topics:', result);
      return result;
    },
    [loadAll],
  );

  /**
   * Create a new topic
   */
  const createTopic = useCallback(
    async (data: { name: string; description?: string; color?: string }) => {
      return create(data as Partial<TopicWithCount>);
    },
    [create],
  );

  /**
   * Update a topic
   */
  const updateTopicById = useCallback(
    async (id: string, data: { name?: string; description?: string; color?: string }) => {
      return update(id, data as Partial<TopicWithCount>);
    },
    [update],
  );

  /**
   * Get notes for a topic
   */
  const getNotesForTopic = useCallback(
    async (
      topicId: string,
      options?: { limit?: number; offset?: number; excludeJournal?: boolean },
    ) => {
      setError(null);
      try {
        const response = await topicAPI.getNotesByTopic(topicId, options);
        const result = handleIpcResponse(response, 'Failed to get notes for topic');
        return result.success ? result.data.notes : [];
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to get notes for topic');
        return [];
      }
    },
    [setError],
  );

  /**
   * Classify a single note
   */
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

  /**
   * Classify all notes (bulk operation - only pending notes)
   */
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
          await loadTopics();
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
    [loadTopics, setClassifying, setError],
  );

  /**
   * Reclassify ALL notes (force reclassification)
   */
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
          await loadTopics();
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
    [loadTopics, setClassifying, setError],
  );

  /**
   * Semantic search
   */
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

  /**
   * Find similar notes
   */
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

  /**
   * Assign topic to note
   */
  const assignTopicToNote = useCallback(
    async (noteId: string, topicId: string) => {
      setError(null);
      try {
        const response = await topicAPI.assignToNote(noteId, topicId);
        return response.success;
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to assign topic to note');
        return false;
      }
    },
    [setError],
  );

  /**
   * Remove topic from note
   */
  const removeTopicFromNote = useCallback(
    async (noteId: string, topicId: string) => {
      setError(null);
      try {
        const response = await topicAPI.removeFromNote(noteId, topicId);
        return response.success;
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to remove topic from note');
        return false;
      }
    },
    [setError],
  );

  /**
   * Get embedding status
   */
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

  /**
   * Recompute all topic centroids
   */
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
    loadTopics,
    createTopic,
    updateTopic: updateTopicById,
    deleteTopic: remove,
    getNotesForTopic,
    classifyNote,
    classifyAllNotes,
    reclassifyAllNotes,
    semanticSearch,
    findSimilarNotes,
    assignTopicToNote,
    removeTopicFromNote,
    getEmbeddingStatus,
    recomputeCentroids,
  };
}
