/**
 * Database Management IPC Handlers
 */

import { DATABASE_CHANNELS, EVENTS } from '@shared/constants/ipcChannels';
import { registerHandler } from '../utils';
import type { Container } from '../../api/container';
import type { AwilixContainer } from 'awilix';

/**
 * Register all database handlers
 */
export function registerDatabaseHandlers(container: AwilixContainer<Container>) {
  const dbManager = container.cradle.db;
  const eventBus = container.cradle.eventBus;

  // db:getStatus
  registerHandler(
    DATABASE_CHANNELS.GET_STATUS,
    async () => {
      const status = await dbManager.getStatus();

      return {
        ...status,
        is_migrating: false,
        vector_size: 0, // TODO: Implement vector DB size
        last_backup: undefined,
        last_defrag: undefined,
      };
    }
  );

  // db:vacuum
  registerHandler(
    DATABASE_CHANNELS.VACUUM,
    async () => {
      const sizeBefore = (await dbManager.getStatus()).databaseSize;

      // Emit progress
      eventBus.emit(EVENTS.DB_VACUUM_PROGRESS, {});

      await dbManager.optimize();

      const sizeAfter = (await dbManager.getStatus()).databaseSize;
      const freedBytes = sizeBefore - sizeAfter;

      // Emit completion
      eventBus.emit(EVENTS.DB_VACUUM_COMPLETE, {});

      return {
        success: true,
        size_before: sizeBefore,
        size_after: sizeAfter,
        freed_bytes: Math.max(0, freedBytes),
      };
    }
  );

  // db:checkIntegrity
  registerHandler(
    DATABASE_CHANNELS.CHECK_INTEGRITY,
    async (event, request: { detailed?: boolean }) => {
      const result = await dbManager.checkIntegrity();

      return {
        ok: result.ok,
        foreign_keys_ok: true,
        errors: result.errors,
        warnings: [],
      };
    }
  );
}
