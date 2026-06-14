/**
 * Search IPC Adapter
 *
 * Primary adapter that handles Electron IPC calls for search operations.
 */

import { ipcMain } from 'electron';
import { SEARCH_CHANNELS } from '@shared/constants/ipcChannels';
import type { ISearchUseCases } from '../../../domain';
import { logger } from '../../../shared';
import { handleIpcRequest } from '@main/shared/utils';

export interface SearchIPCDeps {
  searchUseCases: ISearchUseCases;
}

export function registerSearchHandlers(deps: SearchIPCDeps): void {
  const { searchUseCases } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, {
      loggerPrefix: 'SearchIPC',
      defaultCode: 'SEARCH_ERROR',
      context,
    });

  ipcMain.handle(SEARCH_CHANNELS.FULL_TEXT, async (_event, request) => {
    return handleRequest(
      async () => {
        const result = await searchUseCases.fullTextSearch.execute(request);
        return result;
      },
      {
        channel: SEARCH_CHANNELS.FULL_TEXT,
        query: request?.query,
        workspaceId: request?.workspaceId,
      },
    );
  });

  ipcMain.handle(SEARCH_CHANNELS.SEMANTIC, async (_event, request) => {
    return handleRequest(
      async () => {
        const result = await searchUseCases.semanticSearch.execute(request);
        return result;
      },
      {
        channel: SEARCH_CHANNELS.SEMANTIC,
        query: request?.query,
        workspaceId: request?.workspaceId,
      },
    );
  });

  ipcMain.handle(SEARCH_CHANNELS.HYBRID, async (_event, request) => {
    return handleRequest(
      async () => {
        const result = await searchUseCases.hybridSearch.execute(request);
        return result;
      },
      { channel: SEARCH_CHANNELS.HYBRID, query: request?.query, workspaceId: request?.workspaceId },
    );
  });

  ipcMain.handle(SEARCH_CHANNELS.BY_TAG, async (_event, request) => {
    return handleRequest(
      async () => {
        const result = await searchUseCases.searchByTags.execute(request);
        return result;
      },
      { channel: SEARCH_CHANNELS.BY_TAG, tags: request?.tags, workspaceId: request?.workspaceId },
    );
  });

  ipcMain.handle(SEARCH_CHANNELS.BY_DATE_RANGE, async (_event, request) => {
    return handleRequest(
      async () => {
        const result = await searchUseCases.searchByDateRange.execute(request);
        return result;
      },
      {
        channel: SEARCH_CHANNELS.BY_DATE_RANGE,
        startDate: request?.startDate,
        endDate: request?.endDate,
        workspaceId: request?.workspaceId,
      },
    );
  });

  ipcMain.handle(SEARCH_CHANNELS.GET_RELATED, async (_event, request) => {
    return handleRequest(async () => searchUseCases.getRelatedNotes.execute(request), {
      channel: SEARCH_CHANNELS.GET_RELATED,
      noteId: request?.noteId,
      limit: request?.limit,
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
