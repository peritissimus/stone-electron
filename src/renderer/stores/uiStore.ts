/**
 * UI Store - Zustand state management for UI state
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ViewMode = 'list' | 'grid' | 'card'
type SidebarPanel = 'home' | 'folders' | 'tags' | 'search'
type SortBy = 'updated' | 'created' | 'title' | 'favorite'
type SortOrder = 'asc' | 'desc'

interface UIState {
  // Sidebar
  sidebarOpen: boolean
  sidebarWidth: number
  sidebarPanel: SidebarPanel

  // Note list
  noteListWidth: number
  viewMode: ViewMode
  sortBy: SortBy
  sortOrder: SortOrder
  showArchived: boolean

  // Editor
  editorFullscreen: boolean
  showPreview: boolean
  showOutline: boolean

  // Search
  searchQuery: string
  searchOpen: boolean

  // Modals
  settingsOpen: boolean
  exportModalOpen: boolean
  importModalOpen: boolean

  // Theme
  theme: 'light' | 'dark' | 'system'

  // Actions
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  setSidebarPanel: (panel: SidebarPanel) => void
  setNoteListWidth: (width: number) => void
  setViewMode: (mode: ViewMode) => void
  setSortBy: (sort: SortBy) => void
  toggleSortOrder: () => void
  toggleShowArchived: () => void
  toggleEditorFullscreen: () => void
  togglePreview: () => void
  toggleOutline: () => void
  setSearchQuery: (query: string) => void
  toggleSearch: () => void
  openSettings: () => void
  closeSettings: () => void
  openExportModal: () => void
  closeExportModal: () => void
  openImportModal: () => void
  closeImportModal: () => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Sidebar
      sidebarOpen: true,
      sidebarWidth: 240,
      sidebarPanel: 'home',

      // Note list
      noteListWidth: 320,
      viewMode: 'list',
      sortBy: 'updated',
      sortOrder: 'desc',
      showArchived: false,

      // Editor
      editorFullscreen: false,
      showPreview: false,
      showOutline: true,

      // Search
      searchQuery: '',
      searchOpen: false,

      // Modals
      settingsOpen: false,
      exportModalOpen: false,
      importModalOpen: false,

      // Theme
      theme: 'dark',

      // Actions
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(400, width)) }),

      setSidebarPanel: (panel) => set({ sidebarPanel: panel }),

      setNoteListWidth: (width) => set({ noteListWidth: Math.max(280, Math.min(480, width)) }),

      setViewMode: (mode) => set({ viewMode: mode }),

      setSortBy: (sort) => set({ sortBy: sort }),

      toggleSortOrder: () => set((state) => ({ sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc' })),

      toggleShowArchived: () => set((state) => ({ showArchived: !state.showArchived })),

      toggleEditorFullscreen: () => set((state) => ({ editorFullscreen: !state.editorFullscreen })),

      togglePreview: () => set((state) => ({ showPreview: !state.showPreview })),

      toggleOutline: () => set((state) => ({ showOutline: !state.showOutline })),

      setSearchQuery: (query) => set({ searchQuery: query }),

      toggleSearch: () => set((state) => ({ searchOpen: !state.searchOpen })),

      openSettings: () => set({ settingsOpen: true }),

      closeSettings: () => set({ settingsOpen: false }),

      openExportModal: () => set({ exportModalOpen: true }),

      closeExportModal: () => set({ exportModalOpen: false }),

      openImportModal: () => set({ importModalOpen: true }),

      closeImportModal: () => set({ importModalOpen: false }),

      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'stone-ui-preferences',
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
        noteListWidth: state.noteListWidth,
        viewMode: state.viewMode,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        showArchived: state.showArchived,
        showPreview: state.showPreview,
        showOutline: state.showOutline,
        theme: state.theme,
      }),
    }
  )
)
