/**
 * IPC Handler Registration
 *
 * This module registers all IPC handlers for communication between
 * the main process and renderer process.
 */

import { registerWorkspaceHandlers } from './handlers/workspaceHandlers'
import { registerNoteHandlers } from './handlers/noteHandlers'
import { registerNotebookHandlers } from './handlers/notebookHandlers'
import { registerTagHandlers } from './handlers/tagHandlers'
import { registerTopicHandlers } from './handlers/topicHandlers'
import { registerSearchHandlers } from './handlers/searchHandlers'
import { registerAttachmentHandlers } from './handlers/attachmentHandlers'
import { registerDatabaseHandlers } from './handlers/databaseHandlers'
import { registerSystemHandlers } from './handlers/systemHandlers'
import { logger } from '../utils/logger'
import type { Container } from '../api/container'
import type { AwilixContainer } from 'awilix'

/**
 * Register all IPC handlers
 *
 * Call this function once during app initialization to set up all
 * IPC communication channels between main and renderer processes.
 *
 * @param container - Awilix DI container with all dependencies
 */
export function registerAllIpcHandlers(container: AwilixContainer<Container>): void {
  // Workspace handlers
  registerWorkspaceHandlers(container)

  // Core entity handlers
  registerNoteHandlers(container)
  registerNotebookHandlers(container)
  registerTagHandlers(container)
  registerTopicHandlers(container)
  registerAttachmentHandlers(container)

  // Feature handlers
  registerSearchHandlers(container)
  registerDatabaseHandlers(container)
  registerSystemHandlers(container)

  logger.info('[IPC] All handlers registered successfully')
}
