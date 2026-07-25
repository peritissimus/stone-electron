/**
 * Index API — IPC wrappers for chunk-level retrieval index management.
 */

import {
  IndexNoteResultSchema,
  IndexStatsSchema,
  RebuildAllIndexResultSchema,
} from '@shared/schemas';
import { invokeIpc } from '@renderer/lib/ipc';
import { INDEX_CHANNELS } from '@shared/constants/ipcChannels';
import type { IpcResponse } from '@shared/types';
import { validateResponse } from './validation';

export interface IndexStatsDTO {
  workspaceId: string;
  totalNotes: number;
  indexedNotes: number;
  pendingNotes: number;
  failedNotes: number;
  chunkCount: number;
}

export interface IndexNoteResultDTO {
  noteId: string;
  status: 'indexed' | 'skipped' | 'failed' | 'missing';
  chunkCount: number;
  error?: string;
}

export interface RebuildAllResultDTO {
  workspaceId: string;
  total: number;
  indexed: number;
  skipped: number;
  failed: number;
  missing: number;
}

export const indexAPI = {
  getStats: async (workspaceId?: string): Promise<IpcResponse<IndexStatsDTO>> => {
    const response = await invokeIpc(
      INDEX_CHANNELS.GET_STATS,
      workspaceId === undefined ? {} : { workspaceId },
    );
    return validateResponse(response, IndexStatsSchema);
  },

  indexNote: async (
    noteId: string,
    force = false,
  ): Promise<IpcResponse<IndexNoteResultDTO>> => {
    const response = await invokeIpc(INDEX_CHANNELS.INDEX_NOTE, { noteId, force });
    return validateResponse(response, IndexNoteResultSchema);
  },

  rebuildAll: async (
    workspaceId?: string,
    force = false,
  ): Promise<IpcResponse<RebuildAllResultDTO>> => {
    const response = await invokeIpc(INDEX_CHANNELS.REBUILD_ALL, {
      ...(workspaceId === undefined ? {} : { workspaceId }),
      force,
    });
    return validateResponse(response, RebuildAllIndexResultSchema);
  },
};
