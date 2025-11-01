/**
 * Database Management IPC Handlers
 */

import { ipcMain, BrowserWindow } from 'electron';
import { DATABASE_CHANNELS, EVENTS } from '@shared/constants/ipcChannels';
import { getDatabaseManager } from '../../database';
import { createHandler } from '../utils';

/**
 * Register all database handlers
 */
export function registerDatabaseHandlers() {
  const dbManager = getDatabaseManager();

  // db:getStatus
  ipcMain.handle(
    DATABASE_CHANNELS.GET_STATUS,
    createHandler(async () => {
      const status = await dbManager.getStatus();

      return {
        ...status,
        is_migrating: false,
        vector_size: 0, // TODO: Implement vector DB size
        last_backup: undefined,
        last_defrag: undefined,
      };
    }),
  );

  // db:vacuum
  ipcMain.handle(
    DATABASE_CHANNELS.VACUUM,
    createHandler(async () => {
      const sizeBefore = (await dbManager.getStatus()).databaseSize;

      // Emit progress
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.DB_VACUUM_PROGRESS, {});
      });

      await dbManager.optimize();

      const sizeAfter = (await dbManager.getStatus()).databaseSize;
      const freedBytes = sizeBefore - sizeAfter;

      // Emit completion
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.DB_VACUUM_COMPLETE, {});
      });

      return {
        success: true,
        size_before: sizeBefore,
        size_after: sizeAfter,
        freed_bytes: Math.max(0, freedBytes),
      };
    }),
  );

  // db:checkIntegrity
  ipcMain.handle(
    DATABASE_CHANNELS.CHECK_INTEGRITY,
    createHandler(async (event, request: { detailed?: boolean }) => {
      const result = await dbManager.checkIntegrity();

      return {
        ok: result.ok,
        foreign_keys_ok: true,
        errors: result.errors,
        warnings: [],
      };
    }),
  );
}
