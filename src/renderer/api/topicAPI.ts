/**
 * Topic API - IPC channel wrappers for topic/semantic operations
 *
 * Implements: specs/api.ts#TopicAPI
 * Pure functions that wrap IPC channels. No React, no stores.
 */

import { invokeIpc } from '@renderer/lib/ipc';
import { TOPIC_CHANNELS } from '@shared/constants/ipcChannels';
import type {
  Topic,
  TopicWithCount,
  ClassificationResult,
  SimilarNote,
  EmbeddingStatus,
  IpcResponse,
} from '@shared/types';

export const topicAPI = {
  /**
   * Initialize the embedding service
   */
  initialize: (): Promise<IpcResponse<{ success: boolean; ready: boolean }>> =>
    invokeIpc(TOPIC_CHANNELS.INITIALIZE, {}),

  /**
   * Get all topics
   */
  getAll: (options?: {
    excludeJournal?: boolean;
  }): Promise<IpcResponse<{ topics: TopicWithCount[] }>> =>
    invokeIpc(TOPIC_CHANNELS.GET_ALL, options || {}),

  /**
   * Get a topic by ID
   */
  getById: (id: string): Promise<IpcResponse<Topic>> => invokeIpc(TOPIC_CHANNELS.GET_BY_ID, { id }),

  /**
   * Create a new topic
   */
  create: (data: {
    name: string;
    description?: string;
    color?: string;
  }): Promise<IpcResponse<Topic>> => invokeIpc(TOPIC_CHANNELS.CREATE, data),

  /**
   * Update an existing topic
   */
  update: (
    id: string,
    data: Partial<{
      name: string;
      description: string;
      color: string;
    }>,
  ): Promise<IpcResponse<Topic>> => invokeIpc(TOPIC_CHANNELS.UPDATE, { id, ...data }),

  /**
   * Delete a topic
   */
  delete: (id: string): Promise<IpcResponse<void>> => invokeIpc(TOPIC_CHANNELS.DELETE, { id }),

  /**
   * Get notes for a topic
   */
  getNotesByTopic: (
    topicId: string,
    options?: { limit?: number; offset?: number; excludeJournal?: boolean },
  ): Promise<IpcResponse<{ notes: unknown[] }>> =>
    invokeIpc(TOPIC_CHANNELS.GET_NOTES_BY_TOPIC, { topicId, ...options }),

  /**
   * Get topics for a note
   */
  getTopicsForNote: (
    noteId: string,
  ): Promise<
    IpcResponse<{
      topics: Array<{
        noteId: string;
        topicId: string;
        confidence: number;
        isManual: boolean;
        createdAt: string;
        topicName: string;
        topicColor: string;
      }>;
    }>
  > => invokeIpc(TOPIC_CHANNELS.GET_TOPICS_FOR_NOTE, { noteId }),

  /**
   * Assign a topic to a note
   */
  assignToNote: (noteId: string, topicId: string): Promise<IpcResponse<void>> =>
    invokeIpc(TOPIC_CHANNELS.ASSIGN_TO_NOTE, { noteId, topicId }),

  /**
   * Remove a topic from a note
   */
  removeFromNote: (noteId: string, topicId: string): Promise<IpcResponse<void>> =>
    invokeIpc(TOPIC_CHANNELS.REMOVE_FROM_NOTE, { noteId, topicId }),

  /**
   * Classify a single note
   */
  classifyNote: (
    noteId: string,
  ): Promise<IpcResponse<{ noteId: string; topics: ClassificationResult[] }>> =>
    invokeIpc(TOPIC_CHANNELS.CLASSIFY_NOTE, { noteId }),

  /**
   * Classify all pending notes
   */
  classifyAll: (options?: {
    excludeJournal?: boolean;
  }): Promise<IpcResponse<{ processed: number; total: number; failed: number }>> =>
    invokeIpc(TOPIC_CHANNELS.CLASSIFY_ALL, options || {}),

  /**
   * Reclassify all notes (force)
   */
  reclassifyAll: (options?: {
    excludeJournal?: boolean;
  }): Promise<IpcResponse<{ processed: number; total: number; failed: number; skipped: number }>> =>
    invokeIpc(TOPIC_CHANNELS.RECLASSIFY_ALL, options || {}),

  /**
   * Semantic search
   */
  semanticSearch: (
    query: string,
    limit?: number,
  ): Promise<IpcResponse<{ results: SimilarNote[] }>> =>
    invokeIpc(TOPIC_CHANNELS.SEMANTIC_SEARCH, { query, limit }),

  /**
   * Find similar notes
   */
  getSimilarNotes: (
    noteId: string,
    limit?: number,
  ): Promise<IpcResponse<{ similar: SimilarNote[] }>> =>
    invokeIpc(TOPIC_CHANNELS.GET_SIMILAR_NOTES, { noteId, limit }),

  /**
   * Recompute topic centroids
   */
  recomputeCentroids: (): Promise<IpcResponse<void>> =>
    invokeIpc(TOPIC_CHANNELS.RECOMPUTE_CENTROIDS, {}),

  /**
   * Get embedding status
   */
  getEmbeddingStatus: (): Promise<IpcResponse<EmbeddingStatus>> =>
    invokeIpc(TOPIC_CHANNELS.GET_EMBEDDING_STATUS, {}),
};
