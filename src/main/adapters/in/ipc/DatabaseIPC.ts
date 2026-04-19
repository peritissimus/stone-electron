/**
 * Database IPC Adapter - Handles database maintenance IPC channels
 */

import { ipcMain } from 'electron';
import { DATABASE_CHANNELS } from '@shared/constants/ipcChannels';
import type {
  IGetDatabaseStatusUseCase,
  IVacuumDatabaseUseCase,
  ICheckDatabaseIntegrityUseCase,
} from '../../../domain';
import { handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface DatabaseIPCDeps {
  getDatabaseStatus: IGetDatabaseStatusUseCase;
  vacuumDatabase: IVacuumDatabaseUseCase;
  checkDatabaseIntegrity: ICheckDatabaseIntegrityUseCase;
}

export function registerDatabaseHandlers(deps: DatabaseIPCDeps): void {
  const { getDatabaseStatus, vacuumDatabase, checkDatabaseIntegrity } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, { loggerPrefix: 'DatabaseIPC', defaultCode: 'INTERNAL_ERROR', context });

  ipcMain.handle(DATABASE_CHANNELS.GET_STATUS, async () => {
    return handleRequest(
      async () => getDatabaseStatus.execute(),
      { channel: DATABASE_CHANNELS.GET_STATUS },
    );
  });

  ipcMain.handle(DATABASE_CHANNELS.VACUUM, async () => {
    return handleRequest(
      async () => {
        await vacuumDatabase.execute();
        return { success: true };
      },
      { channel: DATABASE_CHANNELS.VACUUM },
    );
  });

  ipcMain.handle(DATABASE_CHANNELS.CHECK_INTEGRITY, async () => {
    return handleRequest(
      async () => checkDatabaseIntegrity.execute(),
      { channel: DATABASE_CHANNELS.CHECK_INTEGRITY },
    );
  });

  logger.info('[IPC] Database handlers registered');
}

export function unregisterDatabaseHandlers(): void {
  ipcMain.removeHandler(DATABASE_CHANNELS.GET_STATUS);
  ipcMain.removeHandler(DATABASE_CHANNELS.VACUUM);
  ipcMain.removeHandler(DATABASE_CHANNELS.CHECK_INTEGRITY);
}
