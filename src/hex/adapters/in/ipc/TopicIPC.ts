/**
 * Topic IPC Adapter - Handles ML topic classification IPC channels
 */

import { ipcMain } from 'electron';
import type { ITopicUseCases } from '../../../domain/ports/in/ITopicUseCases';
import { logger } from '../../../shared/utils';

const CHANNELS = {
  INITIALIZE: 'topics:initialize',
  GET_ALL: 'topics:getAll',
  GET_BY_ID: 'topics:getById',
  CREATE: 'topics:create',
  UPDATE: 'topics:update',
  DELETE: 'topics:delete',
  ASSIGN_TO_NOTE: 'topics:assignToNote',
  REMOVE_FROM_NOTE: 'topics:removeFromNote',
  CLASSIFY_NOTE: 'topics:classifyNote',
  CLASSIFY_ALL: 'topics:classifyAll',
  RECLASSIFY_ALL: 'topics:reclassifyAll',
  SEMANTIC_SEARCH: 'topics:semanticSearch',
  GET_SIMILAR_NOTES: 'topics:getSimilarNotes',
  RECOMPUTE_CENTROIDS: 'topics:recomputeCentroids',
  GET_EMBEDDING_STATUS: 'topics:getEmbeddingStatus',
  GET_NOTES_BY_TOPIC: 'topics:getNotesByTopic',
  GET_TOPICS_FOR_NOTE: 'topics:getTopicsForNote',
} as const;

export interface TopicIPCDeps {
  topicUseCases: ITopicUseCases;
}

export function registerTopicHandlers(deps: TopicIPCDeps): void {
  const { topicUseCases } = deps;

  ipcMain.handle(CHANNELS.INITIALIZE, async () => {
    try {
      logger.info('[IPC] topics:initialize');
      await topicUseCases.initialize();
      return { success: true };
    } catch (error) {
      logger.error('[IPC] topics:initialize error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle(CHANNELS.GET_ALL, async () => {
    try {
      const topics = await topicUseCases.getAllTopics();
      return { success: true, data: topics };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle(CHANNELS.GET_BY_ID, async (_, id: string) => {
    try {
      const topic = await topicUseCases.getTopicById(id);
      return { success: true, data: topic };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle(CHANNELS.CREATE, async (_, data: { name: string; description?: string; color?: string }) => {
    try {
      logger.info('[IPC] topics:create', data);
      const topic = await topicUseCases.createTopic(data);
      return { success: true, data: topic };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle(CHANNELS.UPDATE, async (_, id: string, data: { name?: string; description?: string; color?: string }) => {
    try {
      logger.info('[IPC] topics:update', { id, data });
      const topic = await topicUseCases.updateTopic(id, data);
      return { success: true, data: topic };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle(CHANNELS.DELETE, async (_, id: string) => {
    try {
      logger.info('[IPC] topics:delete', { id });
      await topicUseCases.deleteTopic(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle(CHANNELS.ASSIGN_TO_NOTE, async (_, noteId: string, topicId: string) => {
    try {
      logger.info('[IPC] topics:assignToNote', { noteId, topicId });
      await topicUseCases.assignTopicToNote(noteId, topicId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle(CHANNELS.REMOVE_FROM_NOTE, async (_, noteId: string, topicId: string) => {
    try {
      logger.info('[IPC] topics:removeFromNote', { noteId, topicId });
      await topicUseCases.removeTopicFromNote(noteId, topicId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle(CHANNELS.CLASSIFY_NOTE, async (_, noteId: string, force?: boolean) => {
    try {
      logger.info('[IPC] topics:classifyNote', { noteId, force });
      const result = await topicUseCases.classifyNote(noteId, force);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle(CHANNELS.CLASSIFY_ALL, async (_, options?: { force?: boolean }) => {
    try {
      logger.info('[IPC] topics:classifyAll', options);
      const result = await topicUseCases.classifyAllNotes(options);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle(CHANNELS.RECLASSIFY_ALL, async () => {
    try {
      logger.info('[IPC] topics:reclassifyAll');
      const result = await topicUseCases.classifyAllNotes({ force: true });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle(CHANNELS.SEMANTIC_SEARCH, async (_, query: string, limit?: number) => {
    try {
      const results = await topicUseCases.semanticSearch(query, limit);
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle(CHANNELS.GET_SIMILAR_NOTES, async (_, noteId: string, limit?: number) => {
    try {
      const results = await topicUseCases.getSimilarNotes(noteId, limit);
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle(CHANNELS.RECOMPUTE_CENTROIDS, async () => {
    try {
      logger.info('[IPC] topics:recomputeCentroids');
      await topicUseCases.recomputeCentroids();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle(CHANNELS.GET_EMBEDDING_STATUS, async () => {
    try {
      const status = await topicUseCases.getEmbeddingStatus();
      return { success: true, data: status };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle(CHANNELS.GET_NOTES_BY_TOPIC, async (_, topicId: string, options?: { limit?: number; offset?: number; excludeJournal?: boolean }) => {
    try {
      logger.info('[IPC] topics:getNotesByTopic', { topicId, options });
      const notes = await topicUseCases.getNotesForTopic(topicId, options);
      return { success: true, data: notes };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle(CHANNELS.GET_TOPICS_FOR_NOTE, async (_, noteId: string) => {
    try {
      logger.info('[IPC] topics:getTopicsForNote', { noteId });
      const topics = await topicUseCases.getTopicsForNote(noteId);
      return {
        success: true,
        data: topics.map((t) => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
        })),
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  logger.info('[IPC] Topic handlers registered');
}

export function unregisterTopicHandlers(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
