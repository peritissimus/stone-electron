/**
 * Tag IPC Handlers
 */

import { ipcMain, BrowserWindow } from 'electron'
import { TAG_CHANNELS, EVENTS } from '@shared/constants/ipcChannels'
import { getRepositories } from '../../repositories'
import { createHandler, IpcError } from '../utils'

/**
 * Register all tag handlers
 */
export function registerTagHandlers() {
  const repos = getRepositories()

  // tags:create
  ipcMain.handle(
    TAG_CHANNELS.CREATE,
    createHandler(async (event, request: { name: string; color?: string }) => {
      // Check if tag already exists
      const existing = repos.tag.findOne({ name: request.name })
      if (existing) {
        throw new IpcError('DUPLICATE', 'Tag with this name already exists')
      }

      const tag = repos.tag.create({
        name: request.name,
        color: request.color || '#6b7280',
      })

      // Broadcast event
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.TAG_CREATED, { tag })
      })

      return { ...tag, note_count: 0 }
    })
  )

  // tags:delete
  ipcMain.handle(
    TAG_CHANNELS.DELETE,
    createHandler(async (event, request: { id: string }) => {
      const tag = repos.tag.findById(request.id)
      if (!tag) {
        throw new IpcError('NOT_FOUND', 'Tag not found')
      }

      const noteCount = repos.tag.getAllWithCounts().find((t) => t.id === request.id)?.note_count || 0

      repos.tag.deleteWithAssociations(request.id)

      // Broadcast event
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.TAG_DELETED, { id: request.id })
      })

      return { success: true, affected_notes: noteCount }
    })
  )

  // tags:getAll
  ipcMain.handle(
    TAG_CHANNELS.GET_ALL,
    createHandler(async (event, request: { sort?: 'name' | 'count' | 'recent' }) => {
      const tags = repos.tag.getAllWithCounts()

      // Sort based on request
      if (request.sort === 'count') {
        tags.sort((a, b) => b.note_count - a.note_count || a.name.localeCompare(b.name))
      } else if (request.sort === 'recent') {
        tags.sort((a, b) => b.created_at - a.created_at)
      } else {
        tags.sort((a, b) => a.name.localeCompare(b.name))
      }

      return { tags }
    })
  )

  // tags:addToNote
  ipcMain.handle(
    TAG_CHANNELS.ADD_TO_NOTE,
    createHandler(async (event, request: { note_id: string; tag_ids: string[] }) => {
      const note = repos.note.findById(request.note_id)
      if (!note) {
        throw new IpcError('NOT_FOUND', 'Note not found')
      }

      // Add each tag
      for (const tagId of request.tag_ids) {
        repos.tag.addToNote(request.note_id, tagId)
      }

      const tags = repos.tag.getTagsForNote(request.note_id)

      return {
        success: true,
        note_id: request.note_id,
        tags,
      }
    })
  )

  // tags:removeFromNote
  ipcMain.handle(
    TAG_CHANNELS.REMOVE_FROM_NOTE,
    createHandler(async (event, request: { note_id: string; tag_id: string }) => {
      repos.tag.removeFromNote(request.note_id, request.tag_id)

      return {
        success: true,
        note_id: request.note_id,
      }
    })
  )
}
