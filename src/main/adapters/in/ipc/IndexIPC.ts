/**
 * Index IPC Adapter — exposes chunk-level indexing operations to the renderer.
 */

import { ipcMain } from 'electron';
import { INDEX_CHANNELS } from '@shared/constants/ipcChannels';
import type { IIndexUseCases } from '../../../domain';
import type { IIndexRepository, IWorkspaceRepository } from '../../../domain';
import { handleIpcRequest } from '@main/shared/utils';

export interface IndexIPCDeps {
  indexUseCases: IIndexUseCases;
  indexRepository: IIndexRepository;
  workspaceRepository: IWorkspaceRepository;
}

export function registerIndexHandlers(deps: IndexIPCDeps): void {
  const { indexUseCases, indexRepository, workspaceRepository } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, { loggerPrefix: 'IndexIPC', defaultCode: 'INDEX_ERROR', context });

  ipcMain.handle(INDEX_CHANNELS.GET_STATS, async (_event, request) =>
    handleRequest(
      async () => {
        const workspaceId =
          request?.workspaceId ??
          (await workspaceRepository.findActive())?.id;
        if (!workspaceId) {
          return {
            workspaceId: '',
            totalNotes: 0,
            indexedNotes: 0,
            pendingNotes: 0,
            failedNotes: 0,
            chunkCount: 0,
          };
        }
        const stats = await indexRepository.getWorkspaceStats(workspaceId);
        return { workspaceId, ...stats };
      },
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
