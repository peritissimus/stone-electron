/**
 * Topic API - IPC channel wrappers for topic/semantic operations
 *
 * Implements: specs/api.ts#TopicAPI
 * Pure functions that wrap IPC channels. No React, no stores.
 */

import { z } from 'zod';
import { invokeIpc } from '@renderer/lib/ipc';
import { TOPIC_CHANNELS } from '@shared/constants/ipcChannels';
import type {
  Topic,
  TopicWithCount,
  ClassificationResult,
  SimilarNote,
  EmbeddingStatus,
  IpcResponse,
  SuggestedTopic,
} from '@shared/types';
import { validateResponse } from './validation';
import {
  TopicSchema,
  TopicWithCountSchema,
  ClassificationResultSchema,
  SimilarNoteSchema,
  EmbeddingStatusSchema,
  NoteTopicDetailsSchema,
} from './schemas';

export const topicAPI = {
  /**
   * Initialize the embedding service
   */
  initialize: async (): Promise<IpcResponse<{ success: boolean; ready: boolean }>> => {
    const response = await invokeIpc(TOPIC_CHANNELS.INITIALIZE, {});
    return validateResponse(response, z.object({ success: z.boolean(), ready: z.boolean() }));
  },

  /**
   * Get all topics
   */
  getAll: async (options?: {
    excludeJournal?: boolean;
  }): Promise<IpcResponse<{ topics: TopicWithCount[] }>> => {
    const response = await invokeIpc(TOPIC_CHANNELS.GET_ALL, options || {});
    return validateResponse(response, z.object({ topics: z.array(TopicWithCountSchema) }));
  },

  /**
   * Get a topic by ID
   */
  getById: async (id: string): Promise<IpcResponse<Topic>> => {
    const response = await invokeIpc(TOPIC_CHANNELS.GET_BY_ID, { id });
    return validateResponse(response, TopicSchema);
  },

  /**
   * Create a new topic
   */
  create: async (data: {
    name: string;
    description?: string;
    color?: string;
  }): Promise<IpcResponse<Topic>> => {
    const response = await invokeIpc(TOPIC_CHANNELS.CREATE, data);
    return validateResponse(response, TopicSchema);
  },

  /**
   * Update an existing topic
   */
  update: async (
    id: string,
    data: Partial<{
      name: string;
      description: string;
      color: string;
    }>,
  ): Promise<IpcResponse<Topic>> => {
    const response = await invokeIpc(TOPIC_CHANNELS.UPDATE, { id, ...data });
    return validateResponse(response, TopicSchema);
  },

  /**
   * Delete a topic
   */
  delete: async (id: string): Promise<IpcResponse<void>> => {
    const response = await invokeIpc(TOPIC_CHANNELS.DELETE, { id });
    return validateResponse(response, z.void());
  },

  /**
   * Get notes for a topic
   */
  getNotesByTopic: async (
    topicId: string,
    options?: { limit?: number; offset?: number; excludeJournal?: boolean },
  ): Promise<IpcResponse<{ notes: unknown[] }>> => {
    const response = await invokeIpc(TOPIC_CHANNELS.GET_NOTES_BY_TOPIC, { topicId, ...options });
    return validateResponse(response, z.object({ notes: z.array(z.unknown()) }));
  },

  /**
   * Get topics for a note
   */
  getTopicsForNote: async (
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
  > => {
    const response = await invokeIpc(TOPIC_CHANNELS.GET_TOPICS_FOR_NOTE, { noteId });
    return validateResponse(response, z.object({ topics: z.array(NoteTopicDetailsSchema) }));
  },

  /**
   * Assign a topic to a note
   */
  assignToNote: async (noteId: string, topicId: string): Promise<IpcResponse<void>> => {
    const response = await invokeIpc(TOPIC_CHANNELS.ASSIGN_TO_NOTE, { noteId, topicId });
    return validateResponse(response, z.void());
  },

  /**
   * Remove a topic from a note
   */
  removeFromNote: async (noteId: string, topicId: string): Promise<IpcResponse<void>> => {
    const response = await invokeIpc(TOPIC_CHANNELS.REMOVE_FROM_NOTE, { noteId, topicId });
    return validateResponse(response, z.void());
  },

  /**
   * Classify a single note
   */
  classifyNote: async (
    noteId: string,
  ): Promise<IpcResponse<{ noteId: string; topics: ClassificationResult[] }>> => {
    const response = await invokeIpc(TOPIC_CHANNELS.CLASSIFY_NOTE, { noteId });
    return validateResponse(
      response,
      z.object({ noteId: z.string(), topics: z.array(ClassificationResultSchema) }),
    );
  },

  /**
   * Classify all pending notes
   */
  classifyAll: async (options?: {
    excludeJournal?: boolean;
  }): Promise<IpcResponse<{ processed: number; total: number; failed: number }>> => {
    const response = await invokeIpc(TOPIC_CHANNELS.CLASSIFY_ALL, options || {});
    return validateResponse(
      response,
      z.object({ processed: z.number(), total: z.number(), failed: z.number() }),
    );
  },

  /**
   * Reclassify all notes (force)
   */
  reclassifyAll: async (options?: {
    excludeJournal?: boolean;
  }): Promise<
    IpcResponse<{ processed: number; total: number; failed: number; skipped: number }>
  > => {
    const response = await invokeIpc(TOPIC_CHANNELS.RECLASSIFY_ALL, options || {});
    return validateResponse(
      response,
      z.object({
        processed: z.number(),
        total: z.number(),
        failed: z.number(),
        skipped: z.number(),
      }),
    );
  },

  /**
   * Semantic search
   */
  semanticSearch: async (
    query: string,
    limit?: number,
  ): Promise<IpcResponse<{ results: SimilarNote[] }>> => {
    const response = await invokeIpc(TOPIC_CHANNELS.SEMANTIC_SEARCH, { query, limit });
    return validateResponse(response, z.object({ results: z.array(SimilarNoteSchema) }));
  },

  /**
   * Find similar notes
   */
  getSimilarNotes: async (
    noteId: string,
    limit?: number,
  ): Promise<IpcResponse<{ similar: SimilarNote[] }>> => {
    const response = await invokeIpc(TOPIC_CHANNELS.GET_SIMILAR_NOTES, { noteId, limit });
    return validateResponse(response, z.object({ similar: z.array(SimilarNoteSchema) }));
  },

  /**
   * Recompute topic centroids
   */
  recomputeCentroids: async (): Promise<IpcResponse<void>> => {
    const response = await invokeIpc(TOPIC_CHANNELS.RECOMPUTE_CENTROIDS, {});
    return validateResponse(response, z.void());
  },

  /**
   * Get embedding status
   */
  getEmbeddingStatus: async (): Promise<IpcResponse<EmbeddingStatus>> => {
    const response = await invokeIpc(TOPIC_CHANNELS.GET_EMBEDDING_STATUS, {});
    return validateResponse(response, EmbeddingStatusSchema);
  },

  /**
   * Get suggested topics (unsupervised clusters over chunk embeddings).
   */
  getSuggestions: async (
    workspaceId?: string,
  ): Promise<IpcResponse<{ suggestions: SuggestedTopic[] }>> => {
    const response = await invokeIpc(TOPIC_CHANNELS.GET_SUGGESTIONS, { workspaceId });
    return validateResponse(
      response,
      z.object({ suggestions: z.array(SuggestedTopicSchema) }),
    );
  },

  /**
   * Adopt a suggested topic: create the topic and assign member notes.
   */
  adoptSuggestion: async (
    request: { name: string; color?: string; noteIds: string[] },
  ): Promise<IpcResponse<{ topicId: string; assignedNoteCount: number }>> => {
    const response = await invokeIpc(TOPIC_CHANNELS.ADOPT_SUGGESTION, request);
    return validateResponse(
      response,
      z.object({ topicId: z.string(), assignedNoteCount: z.number() }),
    );
  },
};

const SuggestedTopicRepresentativeSchema = z.object({
  chunkId: z.string(),
  noteId: z.string(),
  noteTitle: z.string(),
  headingPath: z.array(z.string()),
  excerpt: z.string(),
});

const SuggestedTopicSchema = z.object({
  id: z.string(),
  label: z.string(),
  altLabels: z.array(z.string()),
  noteIds: z.array(z.string()),
  chunkIds: z.array(z.string()),
  noteCount: z.number(),
  chunkCount: z.number(),
  cohesion: z.number(),
  representatives: z.array(SuggestedTopicRepresentativeSchema),
});
