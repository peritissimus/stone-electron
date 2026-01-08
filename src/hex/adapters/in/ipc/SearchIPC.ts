/**
 * Search IPC Adapter
 *
 * Primary adapter that handles Electron IPC calls for search operations.
 */

import { ipcMain } from 'electron';
import { SEARCH_CHANNELS } from '@shared/constants/ipcChannels';
import type { ISearchUseCases } from '../../../application/usecases/SearchUseCases';
import { logger } from '@main/utils/logger';

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
      return this.handleRequest(async () => {
        const result = await searchUseCases.fullTextSearch.execute(request);
        return result;
      });
    });

    ipcMain.handle(SEARCH_CHANNELS.SEMANTIC, async (_event, request) => {
      return this.handleRequest(async () => {
        const result = await searchUseCases.semanticSearch.execute(request);
        return result;
      });
    });

    logger.info('[SearchIPC] Handlers registered');
  }

  unregisterHandlers(): void {
    ipcMain.removeHandler(SEARCH_CHANNELS.FULL_TEXT);
    ipcMain.removeHandler(SEARCH_CHANNELS.SEMANTIC);
  }

  private async handleRequest<T>(fn: () => Promise<T>): Promise<IPCResponse<T>> {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[SearchIPC] Error:', { message });
      return { success: false, error: { code: 'SEARCH_ERROR', message } };
    }
  }
}
