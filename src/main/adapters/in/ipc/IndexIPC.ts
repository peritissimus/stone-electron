/**
 * Index IPC Adapter — exposes chunk-level indexing operations to the renderer.
 *
 * Strict IN-adapter shape: depends only on the IIndexUseCases facade.
 * The previous GET_STATS handler used to pull IIndexRepository and
 * IWorkspaceRepository directly and orchestrate them inline — that
 * logic now lives in GetIndexStatsUseCase.
 */

import { ipcMain } from 'electron';
import type { Effect } from 'effect';
import { INDEX_CHANNELS } from '@shared/constants/ipcChannels';
import {
  IndexNoteRequestSchema,
  IndexStatsRequestSchema,
  RebuildIndexRequestSchema,
} from '@shared/schemas';
import type { IIndexUseCases } from '../../../domain';
import { handleIpcRequest } from '@main/shared/utils';

export interface IndexIPCDeps {
  runIndexEffect: RunIndexEffect;
}

export type RunIndexEffect = <A, E>(
  use: (service: IIndexUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export function registerIndexHandlers(deps: IndexIPCDeps): void {
  const { runIndexEffect } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, { loggerPrefix: 'IndexIPC', defaultCode: 'INDEX_ERROR', context });

  ipcMain.handle(INDEX_CHANNELS.GET_STATS, async (_event, rawRequest) =>
    handleRequest(
      async () =>
        runIndexEffect((service) =>
          service.getStats.execute(
            IndexStatsRequestSchema.parse(rawRequest ?? {}),
          ),
        ),
      { channel: INDEX_CHANNELS.GET_STATS },
    ),
  );

  ipcMain.handle(INDEX_CHANNELS.INDEX_NOTE, async (_event, rawRequest) =>
    handleRequest(
      async () => {
        const request = IndexNoteRequestSchema.parse(rawRequest);
        return runIndexEffect((service) =>
          service.indexNote.execute({
            ...request,
            force: request.force ?? false,
          }),
        );
      },
      { channel: INDEX_CHANNELS.INDEX_NOTE },
    ),
  );

  ipcMain.handle(INDEX_CHANNELS.REBUILD_ALL, async (_event, rawRequest) =>
    handleRequest(
      async () => {
        const request = RebuildIndexRequestSchema.parse(rawRequest ?? {});
        return runIndexEffect((service) =>
          service.rebuildAll.execute({
            ...request,
            force: request.force ?? false,
          }),
        );
      },
      { channel: INDEX_CHANNELS.REBUILD_ALL },
    ),
  );
}

export function unregisterIndexHandlers(): void {
  Object.values(INDEX_CHANNELS).forEach((channel) => ipcMain.removeHandler(channel));
}
