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
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, { loggerPrefix: 'GraphIPC', defaultCode: 'GRAPH_ERROR', context });

  ipcMain.handle(NOTE_CHANNELS.GET_BACKLINKS, async (_, { id }: { id: string }) => {
    return handleRequest(
      async () => {
        const notes = await graphUseCases.getBacklinks.execute(id);
        return { notes };
      },
      { channel: NOTE_CHANNELS.GET_BACKLINKS, noteId: id },
    );
  });

  ipcMain.handle(NOTE_CHANNELS.GET_FORWARD_LINKS, async (_, { id }: { id: string }) => {
    return handleRequest(
      async () => {
        const notes = await graphUseCases.getForwardLinks.execute(id);
        return { notes };
      },
      { channel: NOTE_CHANNELS.GET_FORWARD_LINKS, noteId: id },
    );
  });

  ipcMain.handle(
    NOTE_CHANNELS.GET_GRAPH_DATA,
    async (_, options?: { centerNoteId?: string; depth?: number; includeOrphans?: boolean }) => {
      return handleRequest(
        async () => {
          const graphData = await graphUseCases.getGraphData.execute(options);
          return graphData;
        },
        {
          channel: NOTE_CHANNELS.GET_GRAPH_DATA,
          centerNoteId: options?.centerNoteId,
          depth: options?.depth,
          includeOrphans: options?.includeOrphans,
        },
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
