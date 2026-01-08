/**
 * Graph IPC Adapter - Handles note links and graph visualization IPC channels
 */

import { ipcMain } from 'electron';
import type { IGraphUseCases } from '../../../domain/ports/in/IGraphUseCases';
import { logger } from '../../../shared/utils';

const CHANNELS = {
  GET_BACKLINKS: 'notes:getBacklinks',
  GET_FORWARD_LINKS: 'notes:getForwardLinks',
  GET_GRAPH_DATA: 'notes:getGraphData',
} as const;

export interface GraphIPCDeps {
  graphUseCases: IGraphUseCases;
}

export function registerGraphHandlers(deps: GraphIPCDeps): void {
  const { graphUseCases } = deps;

  ipcMain.handle(CHANNELS.GET_BACKLINKS, async (_, noteId: string) => {
    try {
      logger.info('[IPC] notes:getBacklinks', { noteId });
      const backlinks = await graphUseCases.getBacklinks.execute(noteId);
      return { success: true, data: backlinks };
    } catch (error) {
      logger.error('[IPC] notes:getBacklinks error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle(CHANNELS.GET_FORWARD_LINKS, async (_, noteId: string) => {
    try {
      logger.info('[IPC] notes:getForwardLinks', { noteId });
      const forwardLinks = await graphUseCases.getForwardLinks.execute(noteId);
      return { success: true, data: forwardLinks };
    } catch (error) {
      logger.error('[IPC] notes:getForwardLinks error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle(
    CHANNELS.GET_GRAPH_DATA,
    async (_, options?: { centerNoteId?: string; depth?: number; includeOrphans?: boolean }) => {
      try {
        logger.info('[IPC] notes:getGraphData', options);
        const graphData = await graphUseCases.getGraphData.execute(options);
        return { success: true, data: graphData };
      } catch (error) {
        logger.error('[IPC] notes:getGraphData error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  logger.info('[IPC] Graph handlers registered');
}

export function unregisterGraphHandlers(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
