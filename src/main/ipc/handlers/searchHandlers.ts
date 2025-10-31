/**
 * Search IPC Handlers
 */

import { ipcMain } from 'electron'
import { SEARCH_CHANNELS } from '@shared/constants/ipcChannels'
import { getRepositories } from '../../repositories'
import { createHandler } from '../utils'

/**
 * Register all search handlers
 */
export function registerSearchHandlers() {
  const repos = getRepositories()

  // search:fullText
  ipcMain.handle(
    SEARCH_CHANNELS.FULL_TEXT,
    createHandler(
      async (
        event,
        request: { query: string; notebookId?: string; tagIds?: string[]; limit?: number; offset?: number }
      ) => {
        const startTime = Date.now()

        let results = await repos.note.searchFullText(request.query, request.limit || 50)

        // Filter by notebook if specified
        if (request.notebookId) {
          results = results.filter((note) => note.notebookId === request.notebookId)
        }

        // Filter by tags if specified
        if (request.tagIds && request.tagIds.length > 0) {
          results = results.filter((note) => {
            const noteTags = await repos.tag.getTagsForNote(note.id)
            return request.tagIds!.some((tagId) => noteTags.some((t) => t.id === tagId))
          })
        }

        const queryTime = Date.now() - startTime

        return {
          results: results.map((note) => ({
            ...note,
            relevance: 1.0, // FTS5 ranking could be added here
            title_highlight: note.title,
            content_highlight: note.content.substring(0, 200),
          })),
          total: results.length,
          query_time_ms: queryTime,
        }
      }
    )
  )

  // search:semantic (placeholder - will implement with vector DB)
  ipcMain.handle(
    SEARCH_CHANNELS.SEMANTIC,
    createHandler(
      async (
        event,
        request: { query: string; threshold?: number; limit?: number; notebookId?: string }
      ) => {
        // TODO: Implement vector search with Vectra
        // For now, fallback to full-text search
        const startTime = Date.now()
        const results = await repos.note.searchFullText(request.query, request.limit || 20)
        const queryTime = Date.now() - startTime

        return {
          results: results.map((note) => ({
            ...note,
            contentPreview: note.content.substring(0, 200),
            similarity: 0.8, // Placeholder similarity score
          })),
          total: results.length,
          query_time_ms: queryTime,
        }
      }
    )
  )

  // search:hybrid
  ipcMain.handle(
    SEARCH_CHANNELS.HYBRID,
    createHandler(
      async (
        event,
        request: {
          query: string
          weights?: { fts: number; semantic: number }
          limit?: number
          notebookId?: string
          tagIds?: string[]
        }
      ) => {
        const startTime = Date.now()

        // For now, just use FTS (will combine with vector search later)
        const results = await repos.note.searchFullText(request.query, request.limit || 50)

        const queryTime = Date.now() - startTime

        return {
          results: results.map((note) => ({
            ...note,
            contentPreview: note.content.substring(0, 200),
            score: 1.0,
            search_type: 'fts' as const,
          })),
          total: results.length,
          query_time_ms: queryTime,
        }
      }
    )
  )

  // search:byTag
  ipcMain.handle(
    SEARCH_CHANNELS.BY_TAG,
    createHandler(
      async (event, request: { tagIds: string[]; match_all?: boolean; limit?: number; offset?: number }) => {
        let notes

        if (request.match_all) {
          // AND logic - notes must have all tags
          notes = repos.note.findByTags(request.tagIds)
        } else {
          // OR logic - notes with any of the tags
          const noteSet = new Set<string>()
          for (const tagId of request.tagIds) {
            const tagNotes = await repos.note.findByTag(tagId)
            tagNotes.forEach((note) => noteSet.add(note.id))
          }

          notes = Array.from(noteSet)
            .map((id) => await repos.note.findById(id))
            .filter((note): note is NonNullable<typeof note> => note !== null)
        }

        return {
          notes: notes.slice(request.offset || 0, (request.offset || 0) + (request.limit || notes.length)),
          total: notes.length,
        }
      }
    )
  )

  // search:byDateRange
  ipcMain.handle(
    SEARCH_CHANNELS.BY_DATE_RANGE,
    createHandler(
      async (
        event,
        request: { start_date: number; end_date: number; field?: 'created' | 'updated'; limit?: number }
      ) => {
        const field = request.field === 'created' ? 'created_at' : 'updated_at'
        const notes = await repos.note.findByDateRange(request.start_date, request.end_date, field)

        return {
          notes: notes.slice(0, request.limit || notes.length),
          total: notes.length,
        }
      }
    )
  )
}
