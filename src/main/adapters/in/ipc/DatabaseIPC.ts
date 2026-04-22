/**
 * Database IPC Adapter - Handles database maintenance IPC channels.
 *
 * Only GET_STATUS / VACUUM / CHECK_INTEGRITY are registered. The other
 * constants under DATABASE_CHANNELS (RUN_MIGRATIONS / BACKUP / RESTORE /
 * EXPORT / IMPORT / GET_MIGRATION_HISTORY) are placeholders with no
 * handlers; the renderer should not call them.
 */

import { ipcMain } from 'electron';
import { DATABASE_CHANNELS } from '@shared/constants/ipcChannels';
import type {
  IGetDatabaseStatusUseCase,
  IVacuumDatabaseUseCase,
  ICheckDatabaseIntegrityUseCase,
} from '../../../domain';
import type {
  CheckDatabaseIntegrityResponse,
  DatabaseStatusResponse,
  VacuumDatabaseResponse,
} from '@shared/schemas';
import { COMMON_IPC_ERROR_MAP, handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface DatabaseIPCDeps {
  getDatabaseStatus: IGetDatabaseStatusUseCase;
  vacuumDatabase: IVacuumDatabaseUseCase;
  checkDatabaseIntegrity: ICheckDatabaseIntegrityUseCase;
}

export function registerDatabaseHandlers(deps: DatabaseIPCDeps): void {
  const { getDatabaseStatus, vacuumDatabase, checkDatabaseIntegrity } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest<T>(fn, {
      loggerPrefix: 'DatabaseIPC',
      defaultCode: 'INTERNAL_ERROR',
      errorMap: { ...COMMON_IPC_ERROR_MAP },
      context,
    });

  ipcMain.handle(DATABASE_CHANNELS.GET_STATUS, async () => {
    return handleRequest<DatabaseStatusResponse>(
      async () => getDatabaseStatus.execute(),
      { channel: DATABASE_CHANNELS.GET_STATUS },
    );
  });

  ipcMain.handle(DATABASE_CHANNELS.VACUUM, async () => {
    return handleRequest<VacuumDatabaseResponse>(
      async () => vacuumDatabase.execute(),
      { channel: DATABASE_CHANNELS.VACUUM },
    );
  });

  ipcMain.handle(DATABASE_CHANNELS.CHECK_INTEGRITY, async () => {
    return handleRequest<CheckDatabaseIntegrityResponse>(
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
