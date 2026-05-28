/**
 * Index IPC Adapter — exposes chunk-level indexing operations to the renderer.
 *
 * Strict IN-adapter shape: depends only on the IIndexUseCases facade.
 * The previous GET_STATS handler used to pull IIndexRepository and
 * IWorkspaceRepository directly and orchestrate them inline — that
 * logic now lives in GetIndexStatsUseCase.
 */

import { ipcMain } from 'electron';
import { INDEX_CHANNELS } from '@shared/constants/ipcChannels';
import type { IIndexUseCases } from '../../../domain';
import { handleIpcRequest } from '@main/shared/utils';

export interface IndexIPCDeps {
  indexUseCases: IIndexUseCases;
}

export function registerIndexHandlers(deps: IndexIPCDeps): void {
  const { indexUseCases } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, { loggerPrefix: 'IndexIPC', defaultCode: 'INDEX_ERROR', context });

  ipcMain.handle(INDEX_CHANNELS.GET_STATS, async (_event, request) =>
    handleRequest(
      async () => indexUseCases.getStats.execute({ workspaceId: request?.workspaceId }),
      { channel: INDEX_CHANNELS.GET_STATS, workspaceId: request?.workspaceId },
    ),
  );

  ipcMain.handle(INDEX_CHANNELS.INDEX_NOTE, async (_event, request) =>
    handleRequest(
      async () =>
        indexUseCases.indexNote.execute({
          noteId: request.noteId,
          force: request.force ?? false,
        }),
      { channel: INDEX_CHANNELS.INDEX_NOTE, noteId: request?.noteId },
    ),
  );

  ipcMain.handle(INDEX_CHANNELS.REBUILD_ALL, async (_event, request) =>
    handleRequest(
      async () =>
        indexUseCases.rebuildAll.execute({
          workspaceId: request?.workspaceId,
          force: request?.force ?? false,
        }),
      { channel: INDEX_CHANNELS.REBUILD_ALL, workspaceId: request?.workspaceId },
    ),
  );
}

export function unregisterIndexHandlers(): void {
  Object.values(INDEX_CHANNELS).forEach((channel) => ipcMain.removeHandler(channel));
}
