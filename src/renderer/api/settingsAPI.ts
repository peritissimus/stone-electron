/**
 * Settings API - IPC channel wrappers for settings and database operations
 *
 * Pure functions that wrap IPC channels. No React, no stores.
 */

import { invokeIpc } from '@renderer/lib/ipc';
import { SETTINGS_CHANNELS, DATABASE_CHANNELS, SYSTEM_CHANNELS } from '@shared/constants/ipcChannels';
import type {
  Settings,
  DatabaseStatus,
  BackupResult,
  VacuumResult,
  IntegrityResult,
  Migration,
  IpcResponse,
} from '@shared/types';

export const settingsAPI = {
  /**
   * Get a setting by key
   */
  get: <T = string>(key: string): Promise<IpcResponse<{ value: T | null }>> =>
    invokeIpc(SETTINGS_CHANNELS.GET, { key }),

  /**
   * Set a setting
   */
  set: <T = string>(key: string, value: T): Promise<IpcResponse<void>> =>
    invokeIpc(SETTINGS_CHANNELS.SET, { key, value }),

  /**
   * Get all settings
   */
  getAll: (): Promise<IpcResponse<{ settings: Settings[] }>> =>
    invokeIpc(SETTINGS_CHANNELS.GET_ALL, {}),
};

export const databaseAPI = {
  /**
   * Get database status
   */
  getStatus: (): Promise<IpcResponse<DatabaseStatus>> =>
    invokeIpc(DATABASE_CHANNELS.GET_STATUS, {}),

  /**
   * Run pending migrations
   */
  runMigrations: (): Promise<IpcResponse<{ applied: number }>> =>
    invokeIpc(DATABASE_CHANNELS.RUN_MIGRATIONS, {}),

  /**
   * Create a backup
   */
  backup: (path?: string): Promise<IpcResponse<BackupResult>> =>
    invokeIpc(DATABASE_CHANNELS.BACKUP, { path }),

  /**
   * Restore from backup
   */
  restore: (path: string): Promise<IpcResponse<void>> =>
    invokeIpc(DATABASE_CHANNELS.RESTORE, { path }),

  /**
   * Export database
   */
  export: (format: 'json' | 'sqlite'): Promise<IpcResponse<{ path: string }>> =>
    invokeIpc(DATABASE_CHANNELS.EXPORT, { format }),

  /**
   * Import database
   */
  import: (path: string): Promise<IpcResponse<void>> =>
    invokeIpc(DATABASE_CHANNELS.IMPORT, { path }),

  /**
   * Vacuum database (optimize)
   */
  vacuum: (): Promise<IpcResponse<VacuumResult>> =>
    invokeIpc(DATABASE_CHANNELS.VACUUM, {}),

  /**
   * Check database integrity
   */
  checkIntegrity: (): Promise<IpcResponse<IntegrityResult>> =>
    invokeIpc(DATABASE_CHANNELS.CHECK_INTEGRITY, {}),

  /**
   * Get migration history
   */
  getMigrationHistory: (): Promise<IpcResponse<{ migrations: Migration[] }>> =>
    invokeIpc(DATABASE_CHANNELS.GET_MIGRATION_HISTORY, {}),
};

export const systemAPI = {
  /**
   * Get available system fonts
   */
  getFonts: (): Promise<IpcResponse<{ fonts: string[] }>> =>
    invokeIpc(SYSTEM_CHANNELS.GET_FONTS, {}),
};
