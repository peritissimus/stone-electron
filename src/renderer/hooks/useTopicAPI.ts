/**
 * Topic API Hook - React hooks for topic and semantic search operations
 */

import { useCallback } from 'react';
import { useTopicStore } from '@renderer/stores/topicStore';
import type { TopicWithCount, EmbeddingStatus, SimilarNote, ClassificationResult } from '@shared/types';
import { TOPIC_CHANNELS } from '@shared/constants/ipcChannels';

export function useTopicAPI() {
  const {
    setTopics,
    addTopic,
    updateTopic,
    deleteTopic,
    setEmbeddingStatus,
    setSearchResults,
    setLoading,
    setClassifying,
    setError,
  } = useTopicStore();

  /**
   * Initialize the embedding service
   */
  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await window.electron.invoke<{ success: boolean; ready: boolean }>(
        TOPIC_CHANNELS.INITIALIZE,
        {},
      );
      if (response.success && response.data) {
        return response.data.ready;
      } else {
        setError(response.error?.message || 'Failed to initialize embedding service');
        return false;
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to initialize embedding service');
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  /**
   * Load all topics
   */
  const loadTopics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await window.electron.invoke<{ topics: TopicWithCount[] }>(
        TOPIC_CHANNELS.GET_ALL,
        {},
      );
      if (response.success && response.data) {
        setTopics(response.data.topics);
      } else {
        setError(response.error?.message || 'Failed to load topics');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load topics');
    } finally {
      setLoading(false);
    }
  }, [setTopics, setLoading, setError]);

  /**
   * Create a new topic
   */
  const createTopic = useCallback(
    async (data: { name: string; description?: string; color?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const response = await window.electron.invoke<{ topic: TopicWithCount }>(
          TOPIC_CHANNELS.CREATE,
          data,
        );
        if (response.success && response.data) {
          addTopic({ ...response.data.topic, noteCount: 0 });
          return response.data.topic;
        } else {
          setError(response.error?.message || 'Failed to create topic');
          return null;
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to create topic');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [addTopic, setLoading, setError],
  );

  /**
   * Update a topic
   */
  const updateTopicById = useCallback(
    async (id: string, data: { name?: string; description?: string; color?: string }) => {
      setError(null);
      try {
        const response = await window.electron.invoke<{ topic: TopicWithCount }>(
          TOPIC_CHANNELS.UPDATE,
          { id, ...data },
        );
        if (response.success && response.data) {
          updateTopic(id, response.data.topic);
          return response.data.topic;
        } else {
          setError(response.error?.message || 'Failed to update topic');
          return null;
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to update topic');
        return null;
      }
    },
    [updateTopic, setError],
  );

  /**
   * Delete a topic
   */
  const deleteTopicById = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const response = await window.electron.invoke(TOPIC_CHANNELS.DELETE, { id });
        if (response.success) {
          deleteTopic(id);
          return true;
        } else {
          setError(response.error?.message || 'Failed to delete topic');
          return false;
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to delete topic');
        return false;
      }
    },
    [deleteTopic, setError],
  );

  /**
   * Get notes for a topic
   */
  const getNotesForTopic = useCallback(
    async (topicId: string, options?: { limit?: number; offset?: number }) => {
      setError(null);
      try {
        const response = await window.electron.invoke<{ notes: unknown[] }>(
          TOPIC_CHANNELS.GET_NOTES_BY_TOPIC,
          { topicId, ...options },
        );
        if (response.success && response.data) {
          return response.data.notes;
        } else {
          setError(response.error?.message || 'Failed to get notes for topic');
          return [];
        }
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
      setClassifying(true);
      setError(null);
      try {
        const response = await window.electron.invoke<{
          noteId: string;
          topics: ClassificationResult[];
        }>(TOPIC_CHANNELS.CLASSIFY_NOTE, { noteId });
        if (response.success && response.data) {
          return response.data.topics;
        } else {
          setError(response.error?.message || 'Failed to classify note');
          return [];
        }
      } catch (error) {
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
  const classifyAllNotes = useCallback(async () => {
    setClassifying(true);
    setError(null);
    try {
      const response = await window.electron.invoke<{
        processed: number;
        total: number;
        failed: number;
      }>(TOPIC_CHANNELS.CLASSIFY_ALL, {});
      if (response.success && response.data) {
        // Reload topics to get updated counts
        await loadTopics();
        return response.data;
      } else {
        setError(response.error?.message || 'Failed to classify notes');
        return null;
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to classify notes');
      return null;
    } finally {
      setClassifying(false);
    }
  }, [loadTopics, setClassifying, setError]);

  /**
   * Reclassify ALL notes (force reclassification, ignores embedding status)
   */
  const reclassifyAllNotes = useCallback(async () => {
    setClassifying(true);
    setError(null);
    try {
      const response = await window.electron.invoke<{
        processed: number;
        total: number;
        failed: number;
        skipped: number;
      }>(TOPIC_CHANNELS.RECLASSIFY_ALL, {});
      if (response.success && response.data) {
        // Reload topics to get updated counts
        await loadTopics();
        return response.data;
      } else {
        setError(response.error?.message || 'Failed to reclassify notes');
        return null;
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to reclassify notes');
      return null;
    } finally {
      setClassifying(false);
    }
  }, [loadTopics, setClassifying, setError]);

  /**
   * Semantic search
   */
  const semanticSearch = useCallback(
    async (query: string, limit = 10) => {
      setLoading(true);
      setError(null);
      try {
        const response = await window.electron.invoke<{ results: SimilarNote[] }>(
          TOPIC_CHANNELS.SEMANTIC_SEARCH,
          { query, limit },
        );
        if (response.success && response.data) {
          setSearchResults(response.data.results);
          return response.data.results;
        } else {
          setError(response.error?.message || 'Failed to perform semantic search');
          return [];
        }
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
        const response = await window.electron.invoke<{ similar: SimilarNote[] }>(
          TOPIC_CHANNELS.GET_SIMILAR_NOTES,
          { noteId, limit },
        );
        if (response.success && response.data) {
          return response.data.similar;
        } else {
          setError(response.error?.message || 'Failed to find similar notes');
          return [];
        }
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
        const response = await window.electron.invoke(TOPIC_CHANNELS.ASSIGN_TO_NOTE, {
          noteId,
          topicId,
        });
        if (response.success) {
          return true;
        } else {
          setError(response.error?.message || 'Failed to assign topic to note');
          return false;
        }
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
        const response = await window.electron.invoke(TOPIC_CHANNELS.REMOVE_FROM_NOTE, {
          noteId,
          topicId,
        });
        if (response.success) {
          return true;
        } else {
          setError(response.error?.message || 'Failed to remove topic from note');
          return false;
        }
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
    setError(null);
    try {
      const response = await window.electron.invoke<EmbeddingStatus>(
        TOPIC_CHANNELS.GET_EMBEDDING_STATUS,
        {},
      );
      if (response.success && response.data) {
        setEmbeddingStatus(response.data);
        return response.data;
      } else {
        setError(response.error?.message || 'Failed to get embedding status');
        return null;
      }
    } catch (error) {
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
      const response = await window.electron.invoke(TOPIC_CHANNELS.RECOMPUTE_CENTROIDS, {});
      if (response.success) {
        return true;
      } else {
        setError(response.error?.message || 'Failed to recompute centroids');
        return false;
      }
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
    deleteTopic: deleteTopicById,
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
