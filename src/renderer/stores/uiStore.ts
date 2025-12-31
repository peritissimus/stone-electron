/**
 * UI Store - Zustand state management for UI state
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { FontSettings, DEFAULT_FONT_SETTINGS } from '@shared/types/settings'

type ViewMode = 'list' | 'grid' | 'card'
type SidebarPanel = 'home' | 'folders' | 'tags' | 'search'
type SortBy = 'updated' | 'created' | 'title' | 'favorite'
type SortOrder = 'asc' | 'desc'
type AccentColor = 'blue' | 'purple' | 'pink' | 'red' | 'orange' | 'green' | 'teal'

export const ACCENT_COLORS: Record<AccentColor, { name: string; hue: number }> = {
  blue: { name: 'Blue', hue: 211 },
  purple: { name: 'Purple', hue: 270 },
  pink: { name: 'Pink', hue: 330 },
  red: { name: 'Red', hue: 0 },
  orange: { name: 'Orange', hue: 30 },
  green: { name: 'Green', hue: 142 },
  teal: { name: 'Teal', hue: 180 },
}

export type { AccentColor }

interface UIState {
  // Sidebar
  sidebarOpen: boolean
  sidebarCollapsed: boolean
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
  showBlockIndicators: boolean

  // Search
  searchQuery: string
  searchOpen: boolean

  // Modals
  settingsOpen: boolean
  exportModalOpen: boolean
  importModalOpen: boolean
  commandCenterOpen: boolean

  // Theme
  theme: 'light' | 'dark' | 'system'
  accentColor: AccentColor

  // Font settings
  fontSettings: FontSettings

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
  toggleBlockIndicators: () => void
  setSearchQuery: (query: string) => void
  toggleSearch: () => void
  openSettings: () => void
  closeSettings: () => void
  openExportModal: () => void
  closeExportModal: () => void
  openImportModal: () => void
  closeImportModal: () => void
  openCommandCenter: () => void
  closeCommandCenter: () => void
  toggleCommandCenter: () => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setAccentColor: (color: AccentColor) => void
  setFontSettings: (settings: Partial<FontSettings>) => void
  resetFontSettings: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Sidebar
      sidebarOpen: false,
      sidebarCollapsed: false,
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
      showBlockIndicators: false,

      // Search
      searchQuery: '',
      searchOpen: false,

      // Modals
      settingsOpen: false,
      exportModalOpen: false,
      importModalOpen: false,
      commandCenterOpen: false,

      // Theme
      theme: 'system',
      accentColor: 'blue',

      // Font settings
      fontSettings: DEFAULT_FONT_SETTINGS,

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

      toggleBlockIndicators: () => set((state) => ({ showBlockIndicators: !state.showBlockIndicators })),

      setSearchQuery: (query) => set({ searchQuery: query }),

      toggleSearch: () => set((state) => ({ searchOpen: !state.searchOpen })),

      openSettings: () => set({ settingsOpen: true }),

      closeSettings: () => set({ settingsOpen: false }),

      openExportModal: () => set({ exportModalOpen: true }),

      closeExportModal: () => set({ exportModalOpen: false }),

      openImportModal: () => set({ importModalOpen: true }),

      closeImportModal: () => set({ importModalOpen: false }),

      openCommandCenter: () => set({ commandCenterOpen: true }),

      closeCommandCenter: () => set({ commandCenterOpen: false }),

      toggleCommandCenter: () => set((state) => ({ commandCenterOpen: !state.commandCenterOpen })),

      setTheme: (theme) => set({ theme }),

      setAccentColor: (accentColor) => set({ accentColor }),

      setFontSettings: (settings) =>
        set((state) => ({
          fontSettings: { ...state.fontSettings, ...settings },
        })),

      resetFontSettings: () => set({ fontSettings: DEFAULT_FONT_SETTINGS }),
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
        showBlockIndicators: state.showBlockIndicators,
        theme: state.theme,
        accentColor: state.accentColor,
        fontSettings: state.fontSettings,
      }),
    }
  )
)
