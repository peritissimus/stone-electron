/**
 * Version IPC Adapter - Handles note version history IPC channels
 */

import { ipcMain } from 'electron';
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels';
import type { IVersionUseCases, INoteUseCases } from '../../../domain';
import { logger } from '../../../shared';
import { handleIpcRequest } from '@main/shared/utils';

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
  const handleRequest = <T>(fn: () => Promise<T>) =>
    handleIpcRequest(fn, {
      loggerPrefix: 'VersionIPC',
      defaultCode: 'INTERNAL_ERROR',
      errorMap: { VersionNotFoundError: 'VERSION_NOT_FOUND' },
    });

  ipcMain.handle(
    NOTE_CHANNELS.GET_VERSIONS,
    async (_, { id, noteId }: { id?: string; noteId?: string }) => {
      return handleRequest(async () => {
        const resolvedNoteId = noteId ?? id ?? '';
        logger.info('[IPC] notes:getVersions', { noteId: resolvedNoteId });
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
      });
    },
  );

  ipcMain.handle(NOTE_CHANNELS.GET_VERSION, async (_event, versionId: string) => {
    return handleRequest(async () => {
      logger.info('[IPC] notes:getVersion', { versionId });
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
    });
  });

  ipcMain.handle(NOTE_CHANNELS.CREATE_VERSION, async (_event, noteId: string) => {
    return handleRequest(async () => {
      logger.info('[IPC] notes:createVersion', { noteId });
      const version = await versionUseCases.createVersion.execute(noteId);
      return {
        ...version,
        createdAt: version.createdAt.toISOString(),
      };
    });
  });

  ipcMain.handle(
    NOTE_CHANNELS.RESTORE_VERSION,
    async (_, { id, versionId }: { id: string; versionId: string }) => {
      return handleRequest(async () => {
        logger.info('[IPC] notes:restoreVersion', { noteId: id, versionId });
        await versionUseCases.restoreVersion.execute(id, versionId);
        const result = await noteUseCases.getNote.execute({ id, includeContent: false });
        return result.note;
      });
    },
  );

  logger.info('[IPC] Version handlers registered');
}

export function unregisterVersionHandlers(): void {
  VERSION_CHANNELS.forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
