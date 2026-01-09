/**
 * Database IPC Adapter - Handles database maintenance IPC channels
 */

import { ipcMain } from 'electron';
import { DATABASE_CHANNELS } from '@shared/constants/ipcChannels';
import { logger } from '../../../shared';

export interface DatabaseIPCDeps {
  getDatabaseStatus: () => Promise<{ path: string; size: number; isOpen: boolean }>;
  vacuumDatabase: () => Promise<void>;
  checkDatabaseIntegrity: () => Promise<{ ok: boolean; errors: string[] }>;
}

export function registerDatabaseHandlers(deps: DatabaseIPCDeps): void {
  const { getDatabaseStatus, vacuumDatabase, checkDatabaseIntegrity } = deps;

  ipcMain.handle(DATABASE_CHANNELS.GET_STATUS, async () => {
    try {
      logger.info('[IPC] db:getStatus');
      const status = await getDatabaseStatus();
      return {
        success: true,
        data: status,
      };
    } catch (error) {
      logger.error('[IPC] db:getStatus error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle(DATABASE_CHANNELS.VACUUM, async () => {
    try {
      logger.info('[IPC] db:vacuum');
      await vacuumDatabase();
      return { success: true };
    } catch (error) {
      logger.error('[IPC] db:vacuum error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle(DATABASE_CHANNELS.CHECK_INTEGRITY, async () => {
    try {
      logger.info('[IPC] db:checkIntegrity');
      const result = await checkDatabaseIntegrity();
      return { success: true, data: result };
    } catch (error) {
      logger.error('[IPC] db:checkIntegrity error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  logger.info('[IPC] Database handlers registered');
}

export function unregisterDatabaseHandlers(): void {
  ipcMain.removeHandler(DATABASE_CHANNELS.GET_STATUS);
  ipcMain.removeHandler(DATABASE_CHANNELS.VACUUM);
  ipcMain.removeHandler(DATABASE_CHANNELS.CHECK_INTEGRITY);
}
