/**
 * Notebook IPC Handlers
 */

import { BrowserWindow } from 'electron'
import { NOTEBOOK_CHANNELS, EVENTS } from '@shared/constants/ipcChannels'
import { getRepositories } from '../../repositories'
import { registerHandler, IpcError } from '../utils'

/**
 * Register all notebook handlers
 */
export function registerNotebookHandlers() {
  const repos = getRepositories()

  // notebooks:create
  registerHandler(
    NOTEBOOK_CHANNELS.CREATE,
    
      async (
        event,
        request: { name: string; parentId?: string; icon?: string; color?: string; position?: number }
      ) => {
        const notebook = await repos.notebook.create({
          name: request.name,
          parentId: request.parentId || null,
          icon: request.icon || '📁',
          color: request.color || '#3b82f6',
          position: request.position || 0,
        })

        // Broadcast event
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send(EVENTS.NOTEBOOK_CREATED, { notebook })
        })

        const note_count = await repos.notebook.getNoteCount(notebook.id)
        return { ...notebook, note_count }
      }
    )

  // notebooks:update
  registerHandler(
    NOTEBOOK_CHANNELS.UPDATE,
    
      async (event, request: { id: string; name?: string; icon?: string; color?: string; position?: number }) => {
        const updateData: Record<string, unknown> = {}
        if (request.name !== undefined) updateData.name = request.name
        if (request.icon !== undefined) updateData.icon = request.icon
        if (request.color !== undefined) updateData.color = request.color
        if (request.position !== undefined) updateData.position = request.position

        const notebook = await repos.notebook.update(request.id, updateData)

        // Broadcast event
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send(EVENTS.NOTEBOOK_UPDATED, { notebook })
        })

        return notebook
      }
    )

  // notebooks:delete
  registerHandler(
    NOTEBOOK_CHANNELS.DELETE,
    async (event, request: { id: string; delete_notes?: boolean }) => {
      const action = request.delete_notes ? 'delete' : 'orphan'
      await repos.notebook.deleteWithNotes(request.id, action)

      // Broadcast event
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.NOTEBOOK_DELETED, { id: request.id })
      })

      return { success: true, deleted_notebook_count: 1, orphaned_note_count: 0 }
    })

  // notebooks:getAll
  registerHandler(
    NOTEBOOK_CHANNELS.GET_ALL,
    async (event, request: { include_counts?: boolean; flat?: boolean }) => {
      if (request.flat) {
        const notebooks = await repos.notebook.getFlatList()
        return {
          notebooks: await Promise.all(
            notebooks.map(async (nb) => ({
              ...nb,
              note_count: request.include_counts ? await repos.notebook.getNoteCount(nb.id) : 0,
            }))
          ),
        }
      }

      const tree = await repos.notebook.getTree()
      return { notebooks: tree }
    })

  // notebooks:move
  registerHandler(
    NOTEBOOK_CHANNELS.MOVE,
    async (event, request: { id: string; parentId?: string; position?: number }) => {
      try {
        const notebook = await repos.notebook.move(request.id, request.parentId || null, request.position)

        // Broadcast event
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send(EVENTS.NOTEBOOK_UPDATED, { notebook })
        })

        return {
          id: notebook.id,
          parentId: notebook.parentId,
          position: notebook.position,
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('Cannot move notebook')) {
          throw new IpcError('INVALID_OPERATION', error.message)
        }
        throw error
      }
    })
}
