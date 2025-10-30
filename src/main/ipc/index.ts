/**
 * IPC Handler Registration
 *
 * This module registers all IPC handlers for communication between
 * the main process and renderer process.
 */

import { registerNoteHandlers } from './handlers/noteHandlers'
import { registerNotebookHandlers } from './handlers/notebookHandlers'
import { registerTagHandlers } from './handlers/tagHandlers'
import { registerSearchHandlers } from './handlers/searchHandlers'
import { registerAttachmentHandlers } from './handlers/attachmentHandlers'
import { registerDatabaseHandlers } from './handlers/databaseHandlers'
import { registerSettingsHandlers } from './handlers/settingsHandlers'
import { logger } from '../utils/logger'

/**
 * Register all IPC handlers
 *
 * Call this function once during app initialization to set up all
 * IPC communication channels between main and renderer processes.
 */
export function registerAllIpcHandlers(): void {
  // Core entity handlers
  registerNoteHandlers()
  registerNotebookHandlers()
  registerTagHandlers()
  registerAttachmentHandlers()

  // Feature handlers
  registerSearchHandlers()
  registerDatabaseHandlers()
  registerSettingsHandlers()

  logger.info('[IPC] All handlers registered successfully')
}
