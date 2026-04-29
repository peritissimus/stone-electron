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
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, { loggerPrefix: 'TopicIPC', defaultCode: 'INTERNAL_ERROR', context });

  ipcMain.handle(TOPIC_CHANNELS.INITIALIZE, async () => {
    return handleRequest(async () => topicUseCases.initialize.execute(), {
      channel: TOPIC_CHANNELS.INITIALIZE,
    });
  });

  ipcMain.handle(TOPIC_CHANNELS.GET_ALL, async () => {
    return handleRequest(
      async () => {
        const topics = await topicUseCases.getAllTopics.execute();
        return { topics };
      },
      { channel: TOPIC_CHANNELS.GET_ALL },
    );
  });

  ipcMain.handle(TOPIC_CHANNELS.GET_BY_ID, async (_event, { id }: { id: string }) => {
    return handleRequest(async () => topicUseCases.getTopicById.execute(id), {
      channel: TOPIC_CHANNELS.GET_BY_ID,
      topicId: id,
    });
  });

  ipcMain.handle(
    TOPIC_CHANNELS.CREATE,
    async (_event, data: { name: string; description?: string; color?: string }) => {
      return handleRequest(async () => topicUseCases.createTopic.execute(data), {
        channel: TOPIC_CHANNELS.CREATE,
        name: data.name,
      });
    },
  );

  ipcMain.handle(
    TOPIC_CHANNELS.UPDATE,
    async (
      _event,
      { id, ...data }: { id: string; name?: string; description?: string; color?: string },
    ) => {
      return handleRequest(async () => topicUseCases.updateTopic.execute(id, data), {
        channel: TOPIC_CHANNELS.UPDATE,
        topicId: id,
      });
    },
  );

  ipcMain.handle(TOPIC_CHANNELS.DELETE, async (_event, { id }: { id: string }) => {
    return handleRequest(
      async () => {
        await topicUseCases.deleteTopic.execute(id);
        return { success: true };
      },
      { channel: TOPIC_CHANNELS.DELETE, topicId: id },
    );
  });

  ipcMain.handle(
    TOPIC_CHANNELS.ASSIGN_TO_NOTE,
    async (_event, { noteId, topicId }: { noteId: string; topicId: string }) => {
      return handleRequest(
        async () => {
          await topicUseCases.assignTopicToNote.execute(noteId, topicId);
          return { success: true };
        },
        { channel: TOPIC_CHANNELS.ASSIGN_TO_NOTE, noteId, topicId },
      );
    },
  );

  ipcMain.handle(
    TOPIC_CHANNELS.REMOVE_FROM_NOTE,
    async (_event, { noteId, topicId }: { noteId: string; topicId: string }) => {
      return handleRequest(
        async () => {
          await topicUseCases.removeTopicFromNote.execute(noteId, topicId);
          return { success: true };
        },
        { channel: TOPIC_CHANNELS.REMOVE_FROM_NOTE, noteId, topicId },
      );
    },
  );

  ipcMain.handle(
    TOPIC_CHANNELS.CLASSIFY_NOTE,
    async (_event, { noteId, force }: { noteId: string; force?: boolean }) => {
      return handleRequest(async () => topicUseCases.classifyNote.execute(noteId, force), {
        channel: TOPIC_CHANNELS.CLASSIFY_NOTE,
        noteId,
        force,
      });
    },
  );

  ipcMain.handle(
    TOPIC_CHANNELS.CLASSIFY_ALL,
    async (_event, options?: { force?: boolean; excludeJournal?: boolean }) => {
      return handleRequest(async () => topicUseCases.classifyAllNotes.execute(options), {
        channel: TOPIC_CHANNELS.CLASSIFY_ALL,
        force: options?.force,
        excludeJournal: options?.excludeJournal,
      });
    },
  );

  ipcMain.handle(
    TOPIC_CHANNELS.RECLASSIFY_ALL,
    async (_event, options?: { excludeJournal?: boolean }) => {
      return handleRequest(
        async () =>
          topicUseCases.classifyAllNotes.execute({
            force: true,
            excludeJournal: options?.excludeJournal,
          }),
        {
          channel: TOPIC_CHANNELS.RECLASSIFY_ALL,
          force: true,
          excludeJournal: options?.excludeJournal,
        },
      );
    },
  );

  ipcMain.handle(
    TOPIC_CHANNELS.SEMANTIC_SEARCH,
    async (_event, { query, limit }: { query: string; limit?: number }) => {
      return handleRequest(
        async () => {
          const results = await topicUseCases.semanticSearch.execute(query, limit);
          return { results };
        },
        { channel: TOPIC_CHANNELS.SEMANTIC_SEARCH, limit },
      );
    },
  );

  ipcMain.handle(
    TOPIC_CHANNELS.GET_SIMILAR_NOTES,
    async (_event, { noteId, limit }: { noteId: string; limit?: number }) => {
      return handleRequest(
        async () => {
          const similar = await topicUseCases.getSimilarNotes.execute(noteId, limit);
          return { similar };
        },
        { channel: TOPIC_CHANNELS.GET_SIMILAR_NOTES, noteId, limit },
      );
    },
  );

  ipcMain.handle(TOPIC_CHANNELS.RECOMPUTE_CENTROIDS, async () => {
    return handleRequest(
      async () => {
        await topicUseCases.recomputeCentroids.execute();
        return { success: true };
      },
      { channel: TOPIC_CHANNELS.RECOMPUTE_CENTROIDS },
    );
  });

  ipcMain.handle(TOPIC_CHANNELS.GET_EMBEDDING_STATUS, async () => {
    return handleRequest(async () => topicUseCases.getEmbeddingStatus.execute(), {
      channel: TOPIC_CHANNELS.GET_EMBEDDING_STATUS,
    });
  });

  ipcMain.handle(
    TOPIC_CHANNELS.GET_NOTES_BY_TOPIC,
    async (
      _event,
      {
        topicId,
        ...options
      }: { topicId: string; limit?: number; offset?: number; excludeJournal?: boolean },
    ) => {
      return handleRequest(
        async () => {
          const notes = await topicUseCases.getNotesForTopic.execute(topicId, options);
          return { notes };
        },
        { channel: TOPIC_CHANNELS.GET_NOTES_BY_TOPIC, topicId, ...options },
      );
    },
  );

  ipcMain.handle(
    TOPIC_CHANNELS.GET_TOPICS_FOR_NOTE,
    async (_event, { noteId }: { noteId: string }) => {
      return handleRequest(
        async () => {
          const topics = await topicUseCases.getTopicsForNote.execute(noteId);
          return {
            topics: topics.map((t) => ({
              ...t,
              createdAt: t.createdAt.toISOString(),
            })),
          };
        },
        { channel: TOPIC_CHANNELS.GET_TOPICS_FOR_NOTE, noteId },
      );
    },
  );

  logger.info('[IPC] Topic handlers registered');
}

export function unregisterTopicHandlers(): void {
  Object.values(TOPIC_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
