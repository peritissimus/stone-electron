/**
 * Notebook API Hook - React hooks for notebook operations
 */

import { useCallback } from 'react'
import { useNotebookStore } from '../stores/notebookStore'
import { NOTEBOOK_CHANNELS } from '@shared/constants/ipcChannels'

export function useNotebookAPI() {
  const { setNotebooks, addNotebook, updateNotebook, deleteNotebook, setLoading, setError } = useNotebookStore()

  const loadNotebooks = useCallback(
    async (flat = false) => {
      setLoading(true)
      setError(null)
      try {
        const response = await window.electron.invoke(NOTEBOOK_CHANNELS.GET_ALL, {
          include_counts: true,
          flat,
        })
        if (response.success) {
          setNotebooks(response.data.notebooks)
        } else {
          setError(response.error?.message || 'Failed to load notebooks')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load notebooks')
      } finally {
        setLoading(false)
      }
    },
    [setNotebooks, setLoading, setError]
  )

  const createNotebook = useCallback(
    async (data: { name: string; parent_id?: string; icon?: string; color?: string }) => {
      setLoading(true)
      setError(null)
      try {
        const response = await window.electron.invoke(NOTEBOOK_CHANNELS.CREATE, data)
        if (response.success) {
          addNotebook(response.data)
          return response.data
        } else {
          setError(response.error?.message || 'Failed to create notebook')
          return null
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to create notebook')
        return null
      } finally {
        setLoading(false)
      }
    },
    [addNotebook, setLoading, setError]
  )

  const updateNotebookData = useCallback(
    async (id: string, data: { name?: string; icon?: string; color?: string }) => {
      setError(null)
      try {
        const response = await window.electron.invoke(NOTEBOOK_CHANNELS.UPDATE, { id, ...data })
        if (response.success) {
          updateNotebook(response.data)
          return response.data
        } else {
          setError(response.error?.message || 'Failed to update notebook')
          return null
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to update notebook')
        return null
      }
    },
    [updateNotebook, setError]
  )

  const deleteNotebookById = useCallback(
    async (id: string, deleteNotes = false) => {
      setError(null)
      try {
        const response = await window.electron.invoke(NOTEBOOK_CHANNELS.DELETE, {
          id,
          delete_notes: deleteNotes,
        })
        if (response.success) {
          deleteNotebook(id)
          return true
        } else {
          setError(response.error?.message || 'Failed to delete notebook')
          return false
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to delete notebook')
        return false
      }
    },
    [deleteNotebook, setError]
  )

  const moveNotebook = useCallback(
    async (id: string, parentId?: string, position?: number) => {
      setError(null)
      try {
        const response = await window.electron.invoke(NOTEBOOK_CHANNELS.MOVE, {
          id,
          parent_id: parentId,
          position,
        })
        if (response.success) {
          // Reload notebooks to update the tree structure
          await loadNotebooks()
          return true
        } else {
          setError(response.error?.message || 'Failed to move notebook')
          return false
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to move notebook')
        return false
      }
    },
    [loadNotebooks, setError]
  )

  return {
    loadNotebooks,
    createNotebook,
    updateNotebook: updateNotebookData,
    deleteNotebook: deleteNotebookById,
    moveNotebook,
  }
}
