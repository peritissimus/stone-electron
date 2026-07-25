/**
 * Topic API - IPC channel wrappers for semantic search over the note index
 *
 * Implements: specs/api.ts#TopicAPI
 * Pure functions that wrap IPC channels. No React, no stores.
 */

import { z } from '@shared/schemas/schema';
import { invokeIpc } from '@renderer/lib/ipc';
import { TOPIC_CHANNELS } from '@shared/constants/ipcChannels';
import type { SimilarNote, EmbeddingStatus, IpcResponse } from '@shared/types';
import { validateResponse } from './validation';
import { SimilarNoteSchema, EmbeddingStatusSchema } from './schemas';

export const topicAPI = {
  /**
   * Initialize the embedding service
   */
  initialize: async (): Promise<IpcResponse<{ success: boolean; ready: boolean }>> => {
    const response = await invokeIpc(TOPIC_CHANNELS.INITIALIZE, {});
    return validateResponse(response, z.object({ success: z.boolean(), ready: z.boolean() }));
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
   * Get embedding status
   */
  getEmbeddingStatus: async (): Promise<IpcResponse<EmbeddingStatus>> => {
    const response = await invokeIpc(TOPIC_CHANNELS.GET_EMBEDDING_STATUS, {});
    return validateResponse(response, EmbeddingStatusSchema);
  },
};
