/**
 * Settings IPC Handlers
 */

import { ipcMain } from 'electron'
import { SETTINGS_CHANNELS } from '@shared/constants/ipcChannels'
import { getDatabaseManager } from '../../database'
import { createHandler } from '../utils'

/**
 * Register all settings handlers
 */
export function registerSettingsHandlers() {
  const dbManager = getDatabaseManager()

  // settings:get
  ipcMain.handle(
    SETTINGS_CHANNELS.GET,
    createHandler(async (event, request: { key: string }) => {
      const db = dbManager.getDatabase()
      const stmt = db.prepare('SELECT value FROM settings WHERE key = ?')
      const result = stmt.get(request.key) as { value: string } | undefined

      return {
        key: request.key,
        value: result ? result.value : null,
      }
    })
  )

  // settings:set
  ipcMain.handle(
    SETTINGS_CHANNELS.SET,
    createHandler(async (event, request: { key: string; value: string }) => {
      const db = dbManager.getDatabase()
      const stmt = db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key)
        DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `)

      stmt.run(request.key, request.value, Math.floor(Date.now() / 1000))

      return {
        success: true,
        key: request.key,
      }
    })
  )

  // settings:getAll
  ipcMain.handle(
    SETTINGS_CHANNELS.GET_ALL,
    createHandler(async () => {
      const db = dbManager.getDatabase()
      const stmt = db.prepare('SELECT key, value FROM settings')
      const rows = stmt.all() as Array<{ key: string; value: string }>

      const settings: Record<string, string> = {}
      for (const row of rows) {
        settings[row.key] = row.value
      }

      return { settings }
    })
  )
}
