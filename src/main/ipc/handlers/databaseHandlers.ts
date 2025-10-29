/**
 * Database Management IPC Handlers
 */

import { ipcMain, BrowserWindow } from 'electron'
import { DATABASE_CHANNELS, EVENTS } from '@shared/constants/ipcChannels'
import { getDatabaseManager } from '../../database'
import { createHandler } from '../utils'

/**
 * Register all database handlers
 */
export function registerDatabaseHandlers() {
  const dbManager = getDatabaseManager()

  // db:getStatus
  ipcMain.handle(
    DATABASE_CHANNELS.GET_STATUS,
    createHandler(async () => {
      const status = dbManager.getStatus()
      const migrationRunner = dbManager.getMigrationRunner()
      const backupManager = dbManager.getBackupManager()

      const backups = backupManager.listBackups()
      const lastBackup = backups.length > 0 ? backups[0].timestamp : undefined

      return {
        ...status,
        is_migrating: false,
        vector_size: 0, // TODO: Implement vector DB size
        last_backup: lastBackup,
        last_defrag: undefined,
      }
    })
  )

  // db:runMigrations
  ipcMain.handle(
    DATABASE_CHANNELS.RUN_MIGRATIONS,
    createHandler(async (event, request: { auto_backup?: boolean }) => {
      const migrationRunner = dbManager.getMigrationRunner()
      const backupManager = dbManager.getBackupManager()

      const pending = migrationRunner.getPendingMigrations()

      if (pending.length === 0) {
        return {
          success: true,
          migrations_run: 0,
          new_version: migrationRunner.getCurrentVersion(),
        }
      }

      // Create backup if requested
      if (request.auto_backup) {
        await backupManager.createBackup('pre-migration')
      }

      // Run migrations
      let migrationsRun = 0
      for (const migration of pending) {
        // Emit progress
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send(EVENTS.DB_MIGRATION_PROGRESS, {
            current: migrationsRun + 1,
            total: pending.length,
            name: migration.name,
          })
        })

        await migrationRunner.run(migration)
        migrationsRun++
      }

      const newVersion = migrationRunner.getCurrentVersion()

      // Emit completion
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.DB_MIGRATION_COMPLETE, {
          version: newVersion,
          success: true,
        })
      })

      return {
        success: true,
        migrations_run: migrationsRun,
        new_version: newVersion,
      }
    })
  )

  // db:backup
  ipcMain.handle(
    DATABASE_CHANNELS.BACKUP,
    createHandler(async (event, request: { label?: string; include_attachments?: boolean }) => {
      const backupManager = dbManager.getBackupManager()

      const backup = await backupManager.createBackup(request.label || 'manual')

      // Emit completion
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.DB_BACKUP_COMPLETE, { backup_id: backup.id })
      })

      return {
        success: true,
        backup_id: backup.id,
        path: backup.path,
        size: backup.size,
        timestamp: backup.timestamp,
      }
    })
  )

  // db:restore
  ipcMain.handle(
    DATABASE_CHANNELS.RESTORE,
    createHandler(async (event, request: { backup_id: string; verify_first?: boolean }) => {
      const backupManager = dbManager.getBackupManager()

      // TODO: Implement verification
      await backupManager.restoreBackup(request.backup_id)

      // Emit completion
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.DB_RESTORE_COMPLETE, { backup_id: request.backup_id })
      })

      // Get status after restore
      const status = dbManager.getStatus()

      return {
        success: true,
        restored_timestamp: Date.now() / 1000,
        notes_restored: status.note_count,
      }
    })
  )

  // db:export (placeholder)
  ipcMain.handle(
    DATABASE_CHANNELS.EXPORT,
    createHandler(
      async (
        event,
        request: { format: 'markdown' | 'json' | 'html'; notebook_id?: string; include_attachments?: boolean; output_path?: string }
      ) => {
        // TODO: Implement export functionality
        return {
          success: true,
          output_path: request.output_path || '/tmp/export',
          note_count: 0,
          file_size: 0,
        }
      }
    )
  )

  // db:import (placeholder)
  ipcMain.handle(
    DATABASE_CHANNELS.IMPORT,
    createHandler(
      async (
        event,
        request: { format: 'markdown' | 'json' | 'evernote'; input_path: string; target_notebook_id?: string; merge?: boolean }
      ) => {
        // TODO: Implement import functionality
        return {
          success: true,
          imported_count: 0,
          skipped_count: 0,
          errors: [],
        }
      }
    )
  )

  // db:vacuum
  ipcMain.handle(
    DATABASE_CHANNELS.VACUUM,
    createHandler(async () => {
      const sizeBefore = dbManager.getStatus().database_size

      // Emit progress
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.DB_VACUUM_PROGRESS, {})
      })

      dbManager.optimize()

      const sizeAfter = dbManager.getStatus().database_size
      const freedBytes = sizeBefore - sizeAfter

      // Emit completion
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.DB_VACUUM_COMPLETE, {})
      })

      return {
        success: true,
        size_before: sizeBefore,
        size_after: sizeAfter,
        freed_bytes: Math.max(0, freedBytes),
      }
    })
  )

  // db:checkIntegrity
  ipcMain.handle(
    DATABASE_CHANNELS.CHECK_INTEGRITY,
    createHandler(async (event, request: { detailed?: boolean }) => {
      const result = dbManager.checkIntegrity()

      return {
        ok: result.ok,
        foreign_keys_ok: true,
        errors: result.errors,
        warnings: [],
      }
    })
  )

  // db:getMigrationHistory
  ipcMain.handle(
    DATABASE_CHANNELS.GET_MIGRATION_HISTORY,
    createHandler(async () => {
      const migrationRunner = dbManager.getMigrationRunner()
      const migrations = migrationRunner.getMigrationHistory()

      return { migrations }
    })
  )
}
