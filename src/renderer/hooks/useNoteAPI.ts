/**
 * Note API Hook - React hooks for note operations
 */

import { useCallback } from 'react'
import { useNoteStore } from '../stores/noteStore'
import { Note } from '@shared/types'
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels'

export function useNoteAPI() {
  const { setNotes, addNote, updateNote, deleteNote, setLoading, setError } = useNoteStore()

  const loadNotes = useCallback(
    async (filters?: {
      notebook_id?: string
      tag_ids?: string[]
      is_favorite?: boolean
      is_pinned?: boolean
      is_archived?: boolean
    }) => {
      setLoading(true)
      setError(null)
      try {
        const response = await window.electron.invoke(NOTE_CHANNELS.GET_ALL, filters || {})
        if (response.success) {
          setNotes(response.data.notes)
        } else {
          setError(response.error?.message || 'Failed to load notes')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load notes')
      } finally {
        setLoading(false)
      }
    },
    [setNotes, setLoading, setError]
  )

  const createNote = useCallback(
    async (data: { title: string; content: string; notebook_id?: string }) => {
      setLoading(true)
      setError(null)
      try {
        const response = await window.electron.invoke(NOTE_CHANNELS.CREATE, data)
        if (response.success) {
          addNote(response.data)
          return response.data
        } else {
          setError(response.error?.message || 'Failed to create note')
          return null
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to create note')
        return null
      } finally {
        setLoading(false)
      }
    },
    [addNote, setLoading, setError]
  )

  const updateNoteContent = useCallback(
    async (id: string, data: { title?: string; content?: string; notebook_id?: string }) => {
      setError(null)
      try {
        const response = await window.electron.invoke(NOTE_CHANNELS.UPDATE, { id, ...data })
        if (response.success) {
          updateNote(response.data)
          return response.data
        } else {
          setError(response.error?.message || 'Failed to update note')
          return null
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to update note')
        return null
      }
    },
    [updateNote, setError]
  )

  const deleteNoteById = useCallback(
    async (id: string, permanent = false) => {
      setError(null)
      try {
        const response = await window.electron.invoke(NOTE_CHANNELS.DELETE, { id, permanent })
        if (response.success) {
          deleteNote(id)
          return true
        } else {
          setError(response.error?.message || 'Failed to delete note')
          return false
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to delete note')
        return false
      }
    },
    [deleteNote, setError]
  )

  const toggleFavorite = useCallback(
    async (id: string) => {
      setError(null)
      try {
        const response = await window.electron.invoke(NOTE_CHANNELS.FAVORITE, { id })
        if (response.success) {
          updateNote(response.data)
          return response.data
        } else {
          setError(response.error?.message || 'Failed to toggle favorite')
          return null
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to toggle favorite')
        return null
      }
    },
    [updateNote, setError]
  )

  const togglePin = useCallback(
    async (id: string) => {
      setError(null)
      try {
        const response = await window.electron.invoke(NOTE_CHANNELS.PIN, { id })
        if (response.success) {
          updateNote(response.data)
          return response.data
        } else {
          setError(response.error?.message || 'Failed to toggle pin')
          return null
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to toggle pin')
        return null
      }
    },
    [updateNote, setError]
  )

  const toggleArchive = useCallback(
    async (id: string) => {
      setError(null)
      try {
        const response = await window.electron.invoke(NOTE_CHANNELS.ARCHIVE, { id })
        if (response.success) {
          updateNote(response.data)
          return response.data
        } else {
          setError(response.error?.message || 'Failed to toggle archive')
          return null
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to toggle archive')
        return null
      }
    },
    [updateNote, setError]
  )

  const getVersions = useCallback(async (noteId: string) => {
    try {
      const response = await window.electron.invoke(NOTE_CHANNELS.GET_VERSIONS, { note_id: noteId })
      if (response.success) {
        return response.data.versions
      }
      return []
    } catch (error) {
      console.error('Failed to get versions:', error)
      return []
    }
  }, [])

  const restoreVersion = useCallback(
    async (noteId: string, versionId: string) => {
      setError(null)
      try {
        const response = await window.electron.invoke(NOTE_CHANNELS.RESTORE_VERSION, {
          note_id: noteId,
          version_id: versionId,
        })
        if (response.success) {
          updateNote(response.data)
          return response.data
        } else {
          setError(response.error?.message || 'Failed to restore version')
          return null
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to restore version')
        return null
      }
    },
    [updateNote, setError]
  )

  const getBacklinks = useCallback(async (noteId: string) => {
    try {
      const response = await window.electron.invoke(NOTE_CHANNELS.GET_BACKLINKS, { note_id: noteId })
      if (response.success) {
        return response.data.backlinks
      }
      return []
    } catch (error) {
      console.error('Failed to get backlinks:', error)
      return []
    }
  }, [])

  return {
    loadNotes,
    createNote,
    updateNote: updateNoteContent,
    deleteNote: deleteNoteById,
    toggleFavorite,
    togglePin,
    toggleArchive,
    getVersions,
    restoreVersion,
    getBacklinks,
  }
}
