/**
 * Topic IPC Adapter - Handles ML topic classification IPC channels
 */

import { ipcMain } from 'electron';
import { TOPIC_CHANNELS } from '@shared/constants/ipcChannels';
import type { ITopicUseCases } from '../../../domain';
import { handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface TopicIPCDeps {
  topicUseCases: ITopicUseCases;
}

export function registerTopicHandlers(deps: TopicIPCDeps): void {
  const { topicUseCases } = deps;
  const handleRequest = <T>(fn: () => Promise<T>) =>
    handleIpcRequest(fn, { loggerPrefix: 'TopicIPC', defaultCode: 'INTERNAL_ERROR' });

  ipcMain.handle(TOPIC_CHANNELS.INITIALIZE, async () => {
    return handleRequest(async () => {
      logger.info('[IPC] topics:initialize');
      await topicUseCases.initialize();
      return { success: true };
    });
  });

  ipcMain.handle(TOPIC_CHANNELS.GET_ALL, async () => {
    return handleRequest(async () => {
      const topics = await topicUseCases.getAllTopics();
      return { topics };
    });
  });

  ipcMain.handle(TOPIC_CHANNELS.GET_BY_ID, async (_event, { id }: { id: string }) => {
    return handleRequest(async () => {
      const topic = await topicUseCases.getTopicById(id);
      return topic;
    });
  });

  ipcMain.handle(
    TOPIC_CHANNELS.CREATE,
    async (_event, data: { name: string; description?: string; color?: string }) => {
      return handleRequest(async () => {
        logger.info('[IPC] topics:create', data);
        const topic = await topicUseCases.createTopic(data);
        return topic;
      });
    },
  );

  ipcMain.handle(
    TOPIC_CHANNELS.UPDATE,
    async (_event, { id, ...data }: { id: string; name?: string; description?: string; color?: string }) => {
      return handleRequest(async () => {
        logger.info('[IPC] topics:update', { id, data });
        const topic = await topicUseCases.updateTopic(id, data);
        return topic;
      });
    },
  );

  ipcMain.handle(TOPIC_CHANNELS.DELETE, async (_event, { id }: { id: string }) => {
    return handleRequest(async () => {
      logger.info('[IPC] topics:delete', { id });
      await topicUseCases.deleteTopic(id);
      return { success: true };
    });
  });

  ipcMain.handle(
    TOPIC_CHANNELS.ASSIGN_TO_NOTE,
    async (_event, { noteId, topicId }: { noteId: string; topicId: string }) => {
      return handleRequest(async () => {
        logger.info('[IPC] topics:assignToNote', { noteId, topicId });
        await topicUseCases.assignTopicToNote(noteId, topicId);
        return { success: true };
      });
    },
  );

  ipcMain.handle(
    TOPIC_CHANNELS.REMOVE_FROM_NOTE,
    async (_event, { noteId, topicId }: { noteId: string; topicId: string }) => {
      return handleRequest(async () => {
        logger.info('[IPC] topics:removeFromNote', { noteId, topicId });
        await topicUseCases.removeTopicFromNote(noteId, topicId);
        return { success: true };
      });
    },
  );

  ipcMain.handle(
    TOPIC_CHANNELS.CLASSIFY_NOTE,
    async (_event, { noteId, force }: { noteId: string; force?: boolean }) => {
      return handleRequest(async () => {
        logger.info('[IPC] topics:classifyNote', { noteId, force });
        const result = await topicUseCases.classifyNote(noteId, force);
        return result;
      });
    },
  );

  ipcMain.handle(TOPIC_CHANNELS.CLASSIFY_ALL, async (_event, options?: { force?: boolean }) => {
    return handleRequest(async () => {
      logger.info('[IPC] topics:classifyAll', options);
      const result = await topicUseCases.classifyAllNotes(options);
      return result;
    });
  });

  ipcMain.handle(TOPIC_CHANNELS.RECLASSIFY_ALL, async () => {
    return handleRequest(async () => {
      logger.info('[IPC] topics:reclassifyAll');
      const result = await topicUseCases.classifyAllNotes({ force: true });
      return result;
    });
  });

  ipcMain.handle(TOPIC_CHANNELS.SEMANTIC_SEARCH, async (_event, { query, limit }: { query: string; limit?: number }) => {
    return handleRequest(async () => {
      const results = await topicUseCases.semanticSearch(query, limit);
      return { results };
    });
  });

  ipcMain.handle(
    TOPIC_CHANNELS.GET_SIMILAR_NOTES,
    async (_event, { noteId, limit }: { noteId: string; limit?: number }) => {
      return handleRequest(async () => {
        const similar = await topicUseCases.getSimilarNotes(noteId, limit);
        return { similar };
      });
    },
  );

  ipcMain.handle(TOPIC_CHANNELS.RECOMPUTE_CENTROIDS, async () => {
    return handleRequest(async () => {
      logger.info('[IPC] topics:recomputeCentroids');
      await topicUseCases.recomputeCentroids();
      return { success: true };
    });
  });

  ipcMain.handle(TOPIC_CHANNELS.GET_EMBEDDING_STATUS, async () => {
    return handleRequest(async () => {
      const status = await topicUseCases.getEmbeddingStatus();
      return status;
    });
  });

  ipcMain.handle(
    TOPIC_CHANNELS.GET_NOTES_BY_TOPIC,
    async (_event, { topicId, ...options }: { topicId: string; limit?: number; offset?: number; excludeJournal?: boolean }) => {
      return handleRequest(async () => {
        logger.info('[IPC] topics:getNotesByTopic', { topicId, options });
        const notes = await topicUseCases.getNotesForTopic(topicId, options);
        return { notes };
      });
    },
  );

  ipcMain.handle(TOPIC_CHANNELS.GET_TOPICS_FOR_NOTE, async (_event, { noteId }: { noteId: string }) => {
    return handleRequest(async () => {
      logger.info('[IPC] topics:getTopicsForNote', { noteId });
      const topics = await topicUseCases.getTopicsForNote(noteId);
      return {
        topics: topics.map((t) => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
        })),
      };
    });
  });

  logger.info('[IPC] Topic handlers registered');
}

export function unregisterTopicHandlers(): void {
  Object.values(TOPIC_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
