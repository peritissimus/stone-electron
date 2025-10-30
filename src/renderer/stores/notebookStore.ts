/**
 * Notebook Store - Zustand state management for notebooks
 */

import { create } from 'zustand'
import { Notebook } from '@shared/types'

interface NotebookWithChildren extends Notebook {
  children?: NotebookWithChildren[]
  note_count?: number
}

interface NotebookState {
  notebooks: NotebookWithChildren[]
  activeNotebookId: string | null
  expandedIds: Set<string>
  loading: boolean
  error: string | null

  // Actions
  setNotebooks: (notebooks: NotebookWithChildren[]) => void
  addNotebook: (notebook: Notebook) => void
  updateNotebook: (notebook: Notebook) => void
  deleteNotebook: (id: string) => void
  setActiveNotebook: (id: string | null) => void
  toggleExpanded: (id: string) => void
  expandAll: () => void
  collapseAll: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Computed
  getActiveNotebook: () => Notebook | null
  getFlatList: () => Notebook[]
}

export const useNotebookStore = create<NotebookState>((set, get) => ({
  notebooks: [],
  activeNotebookId: null,
  expandedIds: new Set(),
  loading: false,
  error: null,

  setNotebooks: (notebooks) => set({ notebooks }),

  addNotebook: (notebook) =>
    set((state) => ({
      notebooks: [...state.notebooks, notebook],
    })),

  updateNotebook: (notebook) =>
    set((state) => ({
      notebooks: updateNotebookInTree(state.notebooks, notebook),
    })),

  deleteNotebook: (id) =>
    set((state) => ({
      notebooks: removeNotebookFromTree(state.notebooks, id),
      activeNotebookId: state.activeNotebookId === id ? null : state.activeNotebookId,
    })),

  setActiveNotebook: (id) => set({ activeNotebookId: id }),

  toggleExpanded: (id) =>
    set((state) => {
      const newExpanded = new Set(state.expandedIds)
      if (newExpanded.has(id)) {
        newExpanded.delete(id)
      } else {
        newExpanded.add(id)
      }
      return { expandedIds: newExpanded }
    }),

  expandAll: () =>
    set((state) => ({
      expandedIds: new Set(getAllNotebookIds(state.notebooks)),
    })),

  collapseAll: () => set({ expandedIds: new Set() }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  getActiveNotebook: () => {
    const state = get()
    return findNotebookById(state.notebooks, state.activeNotebookId) || null
  },

  getFlatList: () => {
    return flattenNotebooks(get().notebooks)
  },
}))

// Helper functions
function updateNotebookInTree(notebooks: NotebookWithChildren[], updated: Notebook): NotebookWithChildren[] {
  return notebooks.map((nb) => {
    if (nb.id === updated.id) {
      return { ...nb, ...updated }
    }
    if (nb.children) {
      return { ...nb, children: updateNotebookInTree(nb.children, updated) }
    }
    return nb
  })
}

function removeNotebookFromTree(notebooks: NotebookWithChildren[], id: string): NotebookWithChildren[] {
  return notebooks.filter((nb) => nb.id !== id).map((nb) => {
    if (nb.children) {
      return { ...nb, children: removeNotebookFromTree(nb.children, id) }
    }
    return nb
  })
}

function findNotebookById(notebooks: NotebookWithChildren[], id: string | null): Notebook | null {
  if (!id) return null

  for (const nb of notebooks) {
    if (nb.id === id) return nb
    if (nb.children) {
      const found = findNotebookById(nb.children, id)
      if (found) return found
    }
  }
  return null
}

function getAllNotebookIds(notebooks: NotebookWithChildren[]): string[] {
  const ids: string[] = []
  for (const nb of notebooks) {
    ids.push(nb.id)
    if (nb.children) {
      ids.push(...getAllNotebookIds(nb.children))
    }
  }
  return ids
}

function flattenNotebooks(notebooks: NotebookWithChildren[]): Notebook[] {
  const flat: Notebook[] = []
  for (const nb of notebooks) {
    flat.push(nb)
    if (nb.children) {
      flat.push(...flattenNotebooks(nb.children))
    }
  }
  return flat
}
