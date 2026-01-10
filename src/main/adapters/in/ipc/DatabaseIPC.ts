/**
 * Database IPC Adapter - Handles database maintenance IPC channels
 */

import { ipcMain } from 'electron';
import { DATABASE_CHANNELS } from '@shared/constants/ipcChannels';
import { handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface DatabaseIPCDeps {
  getDatabaseStatus: () => Promise<{ path: string; size: number; isOpen: boolean }>;
  vacuumDatabase: () => Promise<void>;
  checkDatabaseIntegrity: () => Promise<{ ok: boolean; errors: string[] }>;
}

export function registerDatabaseHandlers(deps: DatabaseIPCDeps): void {
  const { getDatabaseStatus, vacuumDatabase, checkDatabaseIntegrity } = deps;

  ipcMain.handle(DATABASE_CHANNELS.GET_STATUS, async () => {
    return handleIpcRequest(
      async () => {
        logger.info('[IPC] db:getStatus');
        const status = await getDatabaseStatus();
        return status;
      },
      { loggerPrefix: 'DatabaseIPC', defaultCode: 'INTERNAL_ERROR' },
    );
  });

  ipcMain.handle(DATABASE_CHANNELS.VACUUM, async () => {
    return handleIpcRequest(
      async () => {
        logger.info('[IPC] db:vacuum');
        await vacuumDatabase();
        return { success: true };
      },
      { loggerPrefix: 'DatabaseIPC', defaultCode: 'INTERNAL_ERROR' },
    );
  });

  ipcMain.handle(DATABASE_CHANNELS.CHECK_INTEGRITY, async () => {
    return handleIpcRequest(
      async () => {
        logger.info('[IPC] db:checkIntegrity');
        const result = await checkDatabaseIntegrity();
        return result;
      },
      { loggerPrefix: 'DatabaseIPC', defaultCode: 'INTERNAL_ERROR' },
    );
  });

  logger.info('[IPC] Database handlers registered');
}

export function unregisterDatabaseHandlers(): void {
  ipcMain.removeHandler(DATABASE_CHANNELS.GET_STATUS);
  ipcMain.removeHandler(DATABASE_CHANNELS.VACUUM);
  ipcMain.removeHandler(DATABASE_CHANNELS.CHECK_INTEGRITY);
}
