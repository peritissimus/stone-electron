/**
 * Search IPC Adapter
 *
 * Primary adapter that handles Electron IPC calls for search operations.
 */

import { ipcMain } from 'electron';
import type { Effect } from 'effect';
import { SEARCH_CHANNELS } from '@shared/constants/ipcChannels';
import {
  HybridSearchRequestSchema,
  NoteIdWithLimitRequestSchema,
  SearchByDateRangeRequestSchema,
  SearchByTagsRequestSchema,
  TextSearchRequestSchema,
} from '@shared/schemas';
import type { ISearchUseCases } from '../../../domain';
import { logger } from '../../../shared';
import { handleIpcRequest } from '@main/shared/utils';

export interface SearchIPCDeps {
  runSearchEffect: RunSearchEffect;
}

export type RunSearchEffect = <A, E>(
  use: (service: ISearchUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export function registerSearchHandlers(deps: SearchIPCDeps): void {
  const run = deps.runSearchEffect;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, {
      loggerPrefix: 'SearchIPC',
      defaultCode: 'SEARCH_ERROR',
      context,
    });

  ipcMain.handle(SEARCH_CHANNELS.FULL_TEXT, async (_event, rawRequest) => {
    return handleRequest(
      async () => {
        const request = TextSearchRequestSchema.parse(rawRequest);
        const result = await run((service) =>
          service.fullTextSearch.execute(request),
        );
        return result;
      },
      {
        channel: SEARCH_CHANNELS.FULL_TEXT,
      },
    );
  });

  ipcMain.handle(SEARCH_CHANNELS.SEMANTIC, async (_event, rawRequest) => {
    return handleRequest(
      async () => {
        const request = TextSearchRequestSchema.parse(rawRequest);
        const result = await run((service) =>
          service.semanticSearch.execute(request),
        );
        return result;
      },
      {
        channel: SEARCH_CHANNELS.SEMANTIC,
      },
    );
  });

  ipcMain.handle(SEARCH_CHANNELS.HYBRID, async (_event, rawRequest) => {
    return handleRequest(
      async () => {
        const request = HybridSearchRequestSchema.parse(rawRequest);
        const result = await run((service) =>
          service.hybridSearch.execute(request),
        );
        return result;
      },
      { channel: SEARCH_CHANNELS.HYBRID },
    );
  });

  ipcMain.handle(SEARCH_CHANNELS.BY_TAG, async (_event, rawRequest) => {
    return handleRequest(
      async () => {
        const request = SearchByTagsRequestSchema.parse(rawRequest);
        const result = await run((service) =>
          service.searchByTags.execute(request),
        );
        return result;
      },
      { channel: SEARCH_CHANNELS.BY_TAG },
    );
  });

  ipcMain.handle(SEARCH_CHANNELS.BY_DATE_RANGE, async (_event, rawRequest) => {
    return handleRequest(
      async () => {
        const request = SearchByDateRangeRequestSchema.parse(rawRequest);
        const result = await run((service) =>
          service.searchByDateRange.execute(request),
        );
        return result;
      },
      {
        channel: SEARCH_CHANNELS.BY_DATE_RANGE,
      },
    );
  });

  ipcMain.handle(SEARCH_CHANNELS.GET_RELATED, async (_event, rawRequest) => {
    return handleRequest(async () => run((service) =>
      service.getRelatedNotes.execute(
        NoteIdWithLimitRequestSchema.parse(rawRequest),
      ),
    ), {
      channel: SEARCH_CHANNELS.GET_RELATED,
    });
  });

  logger.info('[SearchIPC] Handlers registered');
}

export function unregisterSearchHandlers(): void {
  ipcMain.removeHandler(SEARCH_CHANNELS.FULL_TEXT);
  ipcMain.removeHandler(SEARCH_CHANNELS.SEMANTIC);
  ipcMain.removeHandler(SEARCH_CHANNELS.HYBRID);
  ipcMain.removeHandler(SEARCH_CHANNELS.BY_TAG);
  ipcMain.removeHandler(SEARCH_CHANNELS.BY_DATE_RANGE);
  ipcMain.removeHandler(SEARCH_CHANNELS.GET_RELATED);
}
