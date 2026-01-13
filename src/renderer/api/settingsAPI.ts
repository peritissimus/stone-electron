/**
 * Settings API - IPC channel wrappers for settings and database operations
 *
 * Implements: specs/api.ts#SettingsAPI, specs/api.ts#DatabaseAPI, specs/api.ts#SystemAPI
 * Pure functions that wrap IPC channels. No React, no stores.
 */

import { z } from 'zod';
import { invokeIpc } from '@renderer/lib/ipc';
import {
  SETTINGS_CHANNELS,
  DATABASE_CHANNELS,
  SYSTEM_CHANNELS,
} from '@shared/constants/ipcChannels';
import type {
  Settings,
  DatabaseStatus,
  BackupResult,
  VacuumResult,
  IntegrityResult,
  Migration,
  IpcResponse,
} from '@shared/types';
import { validateResponse } from './validation';
import {
  SettingsSchema,
  DatabaseStatusSchema,
  BackupResultSchema,
  VacuumResultSchema,
  IntegrityResultSchema,
  MigrationSchema,
} from './schemas';

export const settingsAPI = {
  /**
   * Get a setting by key
   */
  get: async <T = string>(key: string): Promise<IpcResponse<{ value: T | null }>> => {
    const response = await invokeIpc(SETTINGS_CHANNELS.GET, { key });
    return validateResponse(response, z.object({ value: z.unknown().nullable() })) as IpcResponse<{
      value: T | null;
    }>;
  },

  /**
   * Set a setting
   */
  set: async <T = string>(key: string, value: T): Promise<IpcResponse<void>> => {
    const response = await invokeIpc(SETTINGS_CHANNELS.SET, { key, value });
    return validateResponse(response, z.void());
  },

  /**
   * Get all settings
   */
  getAll: async (): Promise<IpcResponse<{ settings: Settings[] }>> => {
    const response = await invokeIpc(SETTINGS_CHANNELS.GET_ALL, {});
    return validateResponse(response, z.object({ settings: z.array(SettingsSchema) }));
  },
};

export const databaseAPI = {
  /**
   * Get database status
   */
  getStatus: async (): Promise<IpcResponse<DatabaseStatus>> => {
    const response = await invokeIpc(DATABASE_CHANNELS.GET_STATUS, {});
    return validateResponse(response, DatabaseStatusSchema);
  },

  /**
   * Run pending migrations
   */
  runMigrations: async (): Promise<IpcResponse<{ applied: number }>> => {
    const response = await invokeIpc(DATABASE_CHANNELS.RUN_MIGRATIONS, {});
    return validateResponse(response, z.object({ applied: z.number() }));
  },

  /**
   * Create a backup
   */
  backup: async (path?: string): Promise<IpcResponse<BackupResult>> => {
    const response = await invokeIpc(DATABASE_CHANNELS.BACKUP, { path });
    return validateResponse(response, BackupResultSchema);
  },

  /**
   * Restore from backup
   */
  restore: async (path: string): Promise<IpcResponse<void>> => {
    const response = await invokeIpc(DATABASE_CHANNELS.RESTORE, { path });
    return validateResponse(response, z.void());
  },

  /**
   * Export database
   */
  export: async (format: 'json' | 'sqlite'): Promise<IpcResponse<{ path: string }>> => {
    const response = await invokeIpc(DATABASE_CHANNELS.EXPORT, { format });
    return validateResponse(response, z.object({ path: z.string() }));
  },

  /**
   * Import database
   */
  import: async (path: string): Promise<IpcResponse<void>> => {
    const response = await invokeIpc(DATABASE_CHANNELS.IMPORT, { path });
    return validateResponse(response, z.void());
  },

  /**
   * Vacuum database (optimize)
   */
  vacuum: async (): Promise<IpcResponse<VacuumResult>> => {
    const response = await invokeIpc(DATABASE_CHANNELS.VACUUM, {});
    return validateResponse(response, VacuumResultSchema);
  },

  /**
   * Check database integrity
   */
  checkIntegrity: async (): Promise<IpcResponse<IntegrityResult>> => {
    const response = await invokeIpc(DATABASE_CHANNELS.CHECK_INTEGRITY, {});
    return validateResponse(response, IntegrityResultSchema);
  },

  /**
   * Get migration history
   */
  getMigrationHistory: async (): Promise<IpcResponse<{ migrations: Migration[] }>> => {
    const response = await invokeIpc(DATABASE_CHANNELS.GET_MIGRATION_HISTORY, {});
    return validateResponse(response, z.object({ migrations: z.array(MigrationSchema) }));
  },
};

export const systemAPI = {
  /**
   * Get available system fonts
   */
  getFonts: async (): Promise<IpcResponse<{ fonts: string[] }>> => {
    const response = await invokeIpc(SYSTEM_CHANNELS.GET_FONTS, {});
    return validateResponse(response, z.object({ fonts: z.array(z.string()) }));
  },
};
