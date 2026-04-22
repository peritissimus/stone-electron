/**
 * Version IPC Adapter - Handles note version history IPC channels
 */

import { ipcMain } from 'electron';
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels';
import {
  GetVersionsRequestSchema,
  RestoreVersionRequestSchema,
  type GetVersionsResponse,
  type NoteResponse,
  type VersionDetailResponse,
} from '@shared/schemas';
import type { IVersionUseCases, INoteUseCases } from '../../../domain';
import { logger } from '../../../shared';
import { COMMON_IPC_ERROR_MAP, handleIpcRequest } from '@main/shared/utils';

export interface VersionIPCDeps {
  versionUseCases: IVersionUseCases;
  noteUseCases: INoteUseCases;
}

const VERSION_CHANNELS = [
  NOTE_CHANNELS.GET_VERSIONS,
  NOTE_CHANNELS.GET_VERSION,
  NOTE_CHANNELS.CREATE_VERSION,
  NOTE_CHANNELS.RESTORE_VERSION,
] as const;

export function registerVersionHandlers(deps: VersionIPCDeps): void {
  const { versionUseCases, noteUseCases } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest<T>(fn, {
      loggerPrefix: 'VersionIPC',
      defaultCode: 'INTERNAL_ERROR',
      errorMap: {
        ...COMMON_IPC_ERROR_MAP,
        VersionNotFoundError: 'VERSION_NOT_FOUND',
      },
      context,
    });

  ipcMain.handle(NOTE_CHANNELS.GET_VERSIONS, async (_event, rawRequest) => {
    const { id, noteId } = GetVersionsRequestSchema.parse(rawRequest);
    const resolvedNoteId = noteId ?? id!;
    return handleRequest<GetVersionsResponse>(
      async () => {
        const versions = await versionUseCases.getVersions.execute(resolvedNoteId);
        return {
          versions: versions.map((v) => ({
            id: v.id,
            noteId: v.noteId,
            versionNumber: v.versionNumber,
            title: v.title,
            contentPreview: v.content.substring(0, 200),
            createdAt: v.createdAt.toISOString(),
            sizeBytes: new Blob([v.content]).size,
          })),
        };
      },
      { channel: NOTE_CHANNELS.GET_VERSIONS, noteId: resolvedNoteId },
    );
  });

  // GET_VERSION and CREATE_VERSION accept a raw string id — not currently
  // called from the renderer, but kept registered for parity with the
  // backend port surface. Request validation here is `z.string()` inline
  // rather than a full schema.
  ipcMain.handle(NOTE_CHANNELS.GET_VERSION, async (_event, versionId: string) => {
    return handleRequest<VersionDetailResponse>(
      async () => {
        const version = await versionUseCases.getVersion.execute(versionId);
        if (!version) {
          const error = new Error('Version not found');
          error.name = 'VersionNotFoundError';
          throw error;
        }
        return {
          ...version,
          createdAt: version.createdAt.toISOString(),
        };
      },
      { channel: NOTE_CHANNELS.GET_VERSION, versionId },
    );
  });

  ipcMain.handle(NOTE_CHANNELS.CREATE_VERSION, async (_event, noteId: string) => {
    return handleRequest<VersionDetailResponse>(
      async () => {
        const version = await versionUseCases.createVersion.execute(noteId);
        return {
          ...version,
          createdAt: version.createdAt.toISOString(),
        };
      },
      { channel: NOTE_CHANNELS.CREATE_VERSION, noteId },
    );
  });

  ipcMain.handle(NOTE_CHANNELS.RESTORE_VERSION, async (_event, rawRequest) => {
    const { id, versionId } = RestoreVersionRequestSchema.parse(rawRequest);
    return handleRequest<NoteResponse>(
      async () => {
        await versionUseCases.restoreVersion.execute(id, versionId);
        const result = await noteUseCases.getNote.execute({ id, includeContent: false });
        return result.note;
      },
      { channel: NOTE_CHANNELS.RESTORE_VERSION, noteId: id, versionId },
    );
  });

  logger.info('[IPC] Version handlers registered');
}

export function unregisterVersionHandlers(): void {
  VERSION_CHANNELS.forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
