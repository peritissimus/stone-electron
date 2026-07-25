/**
 * Topic IPC Adapter — the renderer's window onto the semantic index.
 *
 * Topics themselves are maintained in the background (see TopicOrganizer):
 * nothing out here creates, edits, assigns, or reclassifies them. What the
 * renderer can do is warm the embedder and search by meaning.
 */

import { ipcMain } from 'electron';
import type { Effect } from 'effect';
import { TOPIC_CHANNELS } from '@shared/constants/ipcChannels';
import { TopicSemanticSearchRequestSchema } from '@shared/schemas';
import type { ITopicUseCases } from '../../../domain';
import { handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface TopicIPCDeps {
  runTopicEffect: RunTopicEffect;
}

export type RunTopicEffect = <A, E>(
  use: (service: ITopicUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export function registerTopicHandlers(deps: TopicIPCDeps): void {
  const run = deps.runTopicEffect;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, { loggerPrefix: 'TopicIPC', defaultCode: 'INTERNAL_ERROR', context });

  ipcMain.handle(TOPIC_CHANNELS.INITIALIZE, async () => {
    return handleRequest(async () => run((service) => service.initialize.execute()), {
      channel: TOPIC_CHANNELS.INITIALIZE,
    });
  });

  ipcMain.handle(
    TOPIC_CHANNELS.SEMANTIC_SEARCH,
    async (_event, rawRequest) => {
      const { query, limit } = TopicSemanticSearchRequestSchema.parse(rawRequest);
      return handleRequest(
        async () => {
          const results = await run((service) =>
            service.semanticSearch.execute(query, limit),
          );
          return { results };
        },
        { channel: TOPIC_CHANNELS.SEMANTIC_SEARCH, limit },
      );
    },
  );

  ipcMain.handle(TOPIC_CHANNELS.GET_EMBEDDING_STATUS, async () => {
    return handleRequest(async () => run((service) => service.getEmbeddingStatus.execute()), {
      channel: TOPIC_CHANNELS.GET_EMBEDDING_STATUS,
    });
  });

  logger.info('[IPC] Topic handlers registered');
}

export function unregisterTopicHandlers(): void {
  Object.values(TOPIC_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
