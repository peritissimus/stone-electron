/**
 * Version IPC Adapter - Handles note version history IPC channels
 */

import { ipcMain } from 'electron';
import type { IVersionUseCases } from '../../../domain/ports/in/IVersionUseCases';
import { logger } from '../../../shared/utils';

const CHANNELS = {
  GET_VERSIONS: 'notes:getVersions',
  GET_VERSION: 'notes:getVersion',
  CREATE_VERSION: 'notes:createVersion',
  RESTORE_VERSION: 'notes:restoreVersion',
} as const;

export interface VersionIPCDeps {
  versionUseCases: IVersionUseCases;
}

export function registerVersionHandlers(deps: VersionIPCDeps): void {
  const { versionUseCases } = deps;

  ipcMain.handle(CHANNELS.GET_VERSIONS, async (_, noteId: string) => {
    try {
      logger.info('[IPC] notes:getVersions', { noteId });
      const versions = await versionUseCases.getVersions.execute(noteId);
      return {
        success: true,
        data: versions.map((v) => ({
          id: v.id,
          noteId: v.noteId,
          versionNumber: v.versionNumber,
          title: v.title,
          contentPreview: v.content.substring(0, 200),
          createdAt: v.createdAt.toISOString(),
          sizeBytes: new Blob([v.content]).size,
        })),
      };
    } catch (error) {
      logger.error('[IPC] notes:getVersions error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle(CHANNELS.GET_VERSION, async (_, versionId: string) => {
    try {
      logger.info('[IPC] notes:getVersion', { versionId });
      const version = await versionUseCases.getVersion.execute(versionId);
      if (!version) {
        return { success: false, error: 'Version not found' };
      }
      return {
        success: true,
        data: {
          ...version,
          createdAt: version.createdAt.toISOString(),
        },
      };
    } catch (error) {
      logger.error('[IPC] notes:getVersion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle(CHANNELS.CREATE_VERSION, async (_, noteId: string) => {
    try {
      logger.info('[IPC] notes:createVersion', { noteId });
      const version = await versionUseCases.createVersion.execute(noteId);
      return {
        success: true,
        data: {
          ...version,
          createdAt: version.createdAt.toISOString(),
        },
      };
    } catch (error) {
      logger.error('[IPC] notes:createVersion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle(CHANNELS.RESTORE_VERSION, async (_, noteId: string, versionId: string) => {
    try {
      logger.info('[IPC] notes:restoreVersion', { noteId, versionId });
      await versionUseCases.restoreVersion.execute(noteId, versionId);
      return { success: true };
    } catch (error) {
      logger.error('[IPC] notes:restoreVersion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  logger.info('[IPC] Version handlers registered');
}

export function unregisterVersionHandlers(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
