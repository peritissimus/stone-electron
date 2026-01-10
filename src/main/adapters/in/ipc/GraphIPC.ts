/**
 * Graph IPC Adapter - Handles note links and graph visualization IPC channels
 */

import { ipcMain } from 'electron';
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels';
import type { IGraphUseCases } from '../../../domain';
import { handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface GraphIPCDeps {
  graphUseCases: IGraphUseCases;
}

export function registerGraphHandlers(deps: GraphIPCDeps): void {
  const { graphUseCases } = deps;

  ipcMain.handle(NOTE_CHANNELS.GET_BACKLINKS, async (_, { id }: { id: string }) => {
    logger.info('[IPC] notes:getBacklinks', { id });
    return handleIpcRequest(
      async () => {
        const notes = await graphUseCases.getBacklinks.execute(id);
        return { notes };
      },
      { loggerPrefix: NOTE_CHANNELS.GET_BACKLINKS, defaultCode: 'GRAPH_ERROR' },
    );
  });

  ipcMain.handle(NOTE_CHANNELS.GET_FORWARD_LINKS, async (_, { id }: { id: string }) => {
    logger.info('[IPC] notes:getForwardLinks', { id });
    return handleIpcRequest(
      async () => {
        const notes = await graphUseCases.getForwardLinks.execute(id);
        return { notes };
      },
      { loggerPrefix: NOTE_CHANNELS.GET_FORWARD_LINKS, defaultCode: 'GRAPH_ERROR' },
    );
  });

  ipcMain.handle(
    NOTE_CHANNELS.GET_GRAPH_DATA,
    async (_, options?: { centerNoteId?: string; depth?: number; includeOrphans?: boolean }) => {
      logger.info('[IPC] notes:getGraphData', options);
      return handleIpcRequest(
        async () => {
          const graphData = await graphUseCases.getGraphData.execute(options);
          return graphData;
        },
        { loggerPrefix: NOTE_CHANNELS.GET_GRAPH_DATA, defaultCode: 'GRAPH_ERROR' },
      );
    },
  );

  logger.info('[IPC] Graph handlers registered');
}

export function unregisterGraphHandlers(): void {
  ipcMain.removeHandler(NOTE_CHANNELS.GET_BACKLINKS);
  ipcMain.removeHandler(NOTE_CHANNELS.GET_FORWARD_LINKS);
  ipcMain.removeHandler(NOTE_CHANNELS.GET_GRAPH_DATA);
}
