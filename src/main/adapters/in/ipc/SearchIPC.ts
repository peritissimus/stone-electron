/**
 * Search IPC Adapter
 *
 * Primary adapter that handles Electron IPC calls for search operations.
 */

import { ipcMain } from 'electron';
import { SEARCH_CHANNELS } from '@shared/constants/ipcChannels';
import type { ISearchUseCases } from '../../../application';
import { logger } from '../../../shared';
import { handleIpcRequest } from '@main/shared/utils';

export interface SearchIPCDeps {
  searchUseCases: ISearchUseCases;
}

interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export class SearchIPC {
  constructor(private readonly deps: SearchIPCDeps) {}

  registerHandlers(): void {
    const { searchUseCases } = this.deps;

    ipcMain.handle(SEARCH_CHANNELS.FULL_TEXT, async (_event, request) => {
      return handleIpcRequest(
        async () => {
          const result = await searchUseCases.fullTextSearch.execute(request);
          return result;
        },
        { loggerPrefix: SEARCH_CHANNELS.FULL_TEXT, defaultCode: 'SEARCH_ERROR' },
      );
    });

    ipcMain.handle(SEARCH_CHANNELS.SEMANTIC, async (_event, request) => {
      return handleIpcRequest(
        async () => {
          const result = await searchUseCases.semanticSearch.execute(request);
          return result;
        },
        { loggerPrefix: SEARCH_CHANNELS.SEMANTIC, defaultCode: 'SEARCH_ERROR' },
      );
    });

    ipcMain.handle(SEARCH_CHANNELS.HYBRID, async (_event, request) => {
      return handleIpcRequest(
        async () => {
          const result = await searchUseCases.hybridSearch.execute(request);
          return result;
        },
        { loggerPrefix: SEARCH_CHANNELS.HYBRID, defaultCode: 'SEARCH_ERROR' },
      );
    });

    ipcMain.handle(SEARCH_CHANNELS.BY_TAG, async (_event, request) => {
      return handleIpcRequest(
        async () => {
          const result = await searchUseCases.searchByTags.execute(request);
          return result;
        },
        { loggerPrefix: SEARCH_CHANNELS.BY_TAG, defaultCode: 'SEARCH_ERROR' },
      );
    });

    ipcMain.handle(SEARCH_CHANNELS.BY_DATE_RANGE, async (_event, request) => {
      return handleIpcRequest(
        async () => {
          const result = await searchUseCases.searchByDateRange.execute(request);
          return result;
        },
        { loggerPrefix: SEARCH_CHANNELS.BY_DATE_RANGE, defaultCode: 'SEARCH_ERROR' },
      );
    });

    logger.info('[SearchIPC] Handlers registered');
  }

  unregisterHandlers(): void {
    ipcMain.removeHandler(SEARCH_CHANNELS.FULL_TEXT);
    ipcMain.removeHandler(SEARCH_CHANNELS.SEMANTIC);
    ipcMain.removeHandler(SEARCH_CHANNELS.HYBRID);
    ipcMain.removeHandler(SEARCH_CHANNELS.BY_TAG);
    ipcMain.removeHandler(SEARCH_CHANNELS.BY_DATE_RANGE);
  }
}
