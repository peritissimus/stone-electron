/**
 * Note IPC Handlers
 */

import { ipcMain, BrowserWindow } from 'electron'
import { NOTE_CHANNELS, EVENTS } from '@shared/constants/ipcChannels'
import { getRepositories } from '../../repositories'
import { createHandler, IpcError } from '../utils'

/**
 * Register all note handlers
 */
export function registerNoteHandlers() {
  const repos = getRepositories()

  // notes:create
  ipcMain.handle(
    NOTE_CHANNELS.CREATE,
    createHandler(async (event, request: { title?: string; content?: string; notebook_id?: string; tags?: string[] }) => {
      const note = repos.note.create({
        title: request.title || 'Untitled',
        content: request.content || '',
        notebook_id: request.notebook_id || null,
      })

      // Add tags if provided
      if (request.tags && request.tags.length > 0) {
        repos.tag.setTagsForNote(note.id, request.tags)
      }

      // Broadcast event
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.NOTE_CREATED, { note })
      })

      // Get tags for response
      const tags = repos.tag.getTagsForNote(note.id)
      return { ...note, tags }
    })
  )

  // notes:update
  ipcMain.handle(
    NOTE_CHANNELS.UPDATE,
    createHandler(
      async (
        event,
        request: { id: string; title?: string; content?: string; notebook_id?: string; tags?: string[] }
      ) => {
        const oldNote = repos.note.findById(request.id)
        if (!oldNote) {
          throw new IpcError('NOT_FOUND', 'Note not found')
        }

        // Create version if content changed significantly
        if (request.content && request.content !== oldNote.content) {
          repos.version.createVersion(oldNote.id, oldNote.title, oldNote.content)
        }

        // Update note
        const updateData: Record<string, unknown> = {}
        if (request.title !== undefined) updateData.title = request.title
        if (request.content !== undefined) updateData.content = request.content
        if (request.notebook_id !== undefined) updateData.notebook_id = request.notebook_id

        const note = repos.note.update(request.id, updateData)

        // Update tags if provided
        if (request.tags) {
          repos.tag.setTagsForNote(note.id, request.tags)
        }

        // Broadcast event
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send(EVENTS.NOTE_UPDATED, { note })
        })

        const tags = repos.tag.getTagsForNote(note.id)
        return { ...note, tags }
      }
    )
  )

  // notes:delete
  ipcMain.handle(
    NOTE_CHANNELS.DELETE,
    createHandler(async (event, request: { id: string; permanent?: boolean }) => {
      if (request.permanent) {
        const success = repos.note.permanentDelete(request.id)
        if (!success) {
          throw new IpcError('NOT_FOUND', 'Note not found')
        }
      } else {
        repos.note.softDelete(request.id)
      }

      // Broadcast event
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.NOTE_DELETED, { id: request.id })
      })

      return { success: true, id: request.id }
    })
  )

  // notes:get
  ipcMain.handle(
    NOTE_CHANNELS.GET,
    createHandler(
      async (event, request: { id: string; include_versions?: boolean; include_backlinks?: boolean }) => {
        const note = repos.note.findById(request.id)
        if (!note) {
          throw new IpcError('NOT_FOUND', 'Note not found')
        }

        const tags = repos.tag.getTagsForNote(note.id)
        const attachments = repos.attachment.getAttachmentsForNote(note.id)

        const result: Record<string, unknown> = {
          ...note,
          tags,
          attachments,
        }

        if (request.include_versions) {
          result.versions = repos.version.getVersionSummary(note.id)
        }

        if (request.include_backlinks) {
          result.backlinks = repos.note.getBacklinks(note.id)
        }

        return result
      }
    )
  )

  // notes:getAll
  ipcMain.handle(
    NOTE_CHANNELS.GET_ALL,
    createHandler(
      async (
        event,
        request: {
          notebook_id?: string
          tag_id?: string
          is_favorite?: boolean
          is_pinned?: boolean
          is_archived?: boolean
          is_deleted?: boolean
          sort?: 'updated' | 'created' | 'title'
          order?: 'asc' | 'desc'
          limit?: number
          offset?: number
        }
      ) => {
        let notes

        if (request.tag_id) {
          notes = repos.note.findByTag(request.tag_id)
        } else if (request.is_favorite) {
          notes = repos.note.getFavorites()
        } else if (request.is_pinned) {
          notes = repos.note.getPinned()
        } else if (request.is_deleted) {
          notes = repos.note.getDeleted()
        } else if (request.is_archived) {
          notes = repos.note.getArchived()
        } else if (request.notebook_id) {
          notes = repos.note.findByNotebook(request.notebook_id)
        } else {
          const where: Record<string, unknown> = {}
          if (request.is_deleted !== undefined) where.is_deleted = request.is_deleted ? 1 : 0

          notes = repos.note.findAll({
            where,
            sort: {
              field: request.sort || 'updated_at',
              order: request.order?.toUpperCase() as 'ASC' | 'DESC' || 'DESC',
            },
            limit: request.limit,
            offset: request.offset,
          })
        }

        const total = notes.length
        const items = notes.map((note) => ({
          ...note,
          content_preview: note.content.substring(0, 200),
          tag_count: repos.tag.getTagsForNote(note.id).length,
          attachment_count: repos.attachment.getAttachmentsForNote(note.id).length,
        }))

        return {
          items,
          total,
          hasMore: request.limit ? total > request.limit + (request.offset || 0) : false,
        }
      }
    )
  )

  // notes:favorite
  ipcMain.handle(
    NOTE_CHANNELS.FAVORITE,
    createHandler(async (event, request: { id: string; is_favorite: boolean }) => {
      const note = repos.note.update(request.id, { is_favorite: request.is_favorite ? 1 : 0 })
      return { id: note.id, is_favorite: note.is_favorite }
    })
  )

  // notes:pin
  ipcMain.handle(
    NOTE_CHANNELS.PIN,
    createHandler(async (event, request: { id: string; is_pinned: boolean }) => {
      const note = repos.note.update(request.id, { is_pinned: request.is_pinned ? 1 : 0 })
      return { id: note.id, is_pinned: note.is_pinned }
    })
  )

  // notes:archive
  ipcMain.handle(
    NOTE_CHANNELS.ARCHIVE,
    createHandler(async (event, request: { id: string; is_archived: boolean }) => {
      const note = repos.note.update(request.id, { is_archived: request.is_archived ? 1 : 0 })
      return { id: note.id, is_archived: note.is_archived }
    })
  )

  // notes:getVersions
  ipcMain.handle(
    NOTE_CHANNELS.GET_VERSIONS,
    createHandler(async (event, request: { note_id: string; limit?: number; offset?: number }) => {
      const versions = repos.version.getVersionSummary(request.note_id)
      const total = versions.length

      return { versions, total }
    })
  )

  // notes:restoreVersion
  ipcMain.handle(
    NOTE_CHANNELS.RESTORE_VERSION,
    createHandler(async (event, request: { note_id: string; version_id: string }) => {
      const version = repos.version.findById(request.version_id)
      if (!version) {
        throw new IpcError('NOT_FOUND', 'Version not found')
      }

      // Create a new version from current state before restoring
      const currentNote = repos.note.findById(request.note_id)
      if (currentNote) {
        repos.version.createVersion(currentNote.id, currentNote.title, currentNote.content)
      }

      // Restore the version
      const note = repos.note.update(request.note_id, {
        title: version.title,
        content: version.content,
      })

      // Broadcast event
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.NOTE_VERSION_RESTORED, { note, version })
      })

      return {
        id: note.id,
        title: note.title,
        content: note.content,
        version_number: version.version_number,
        message: 'Version restored successfully',
      }
    })
  )

  // notes:getBacklinks
  ipcMain.handle(
    NOTE_CHANNELS.GET_BACKLINKS,
    createHandler(async (event, request: { note_id: string }) => {
      const backlinks = repos.note.getBacklinks(request.note_id)
      return { backlinks }
    })
  )
}
