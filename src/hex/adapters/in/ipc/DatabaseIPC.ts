/**
 * Database IPC Adapter - Handles database maintenance IPC channels
 */

import { ipcMain } from 'electron';
import { logger } from '../../../shared/utils';

const CHANNELS = {
  GET_STATUS: 'database:getStatus',
  VACUUM: 'database:vacuum',
  CHECK_INTEGRITY: 'database:checkIntegrity',
} as const;

export interface DatabaseIPCDeps {
  getDatabaseStatus: () => Promise<{ path: string; size: number; isOpen: boolean }>;
  vacuumDatabase: () => Promise<void>;
  checkDatabaseIntegrity: () => Promise<{ ok: boolean; errors: string[] }>;
}

export function registerDatabaseHandlers(deps: DatabaseIPCDeps): void {
  const { getDatabaseStatus, vacuumDatabase, checkDatabaseIntegrity } = deps;

  ipcMain.handle(CHANNELS.GET_STATUS, async () => {
    try {
      logger.info('[IPC] database:getStatus');
      const status = await getDatabaseStatus();
      return {
        success: true,
        data: status,
      };
    } catch (error) {
      logger.error('[IPC] database:getStatus error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle(CHANNELS.VACUUM, async () => {
    try {
      logger.info('[IPC] database:vacuum');
      await vacuumDatabase();
      return { success: true };
    } catch (error) {
      logger.error('[IPC] database:vacuum error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle(CHANNELS.CHECK_INTEGRITY, async () => {
    try {
      logger.info('[IPC] database:checkIntegrity');
      const result = await checkDatabaseIntegrity();
      return { success: true, data: result };
    } catch (error) {
      logger.error('[IPC] database:checkIntegrity error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  logger.info('[IPC] Database handlers registered');
}

export function unregisterDatabaseHandlers(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
