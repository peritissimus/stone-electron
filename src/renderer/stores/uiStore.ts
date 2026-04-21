/**
 * UI Store - Zustand state management for UI state
 *
 * Implements: specs/stores.ts#UIStoreState
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { tokens } from '@renderer/specs';
import type {
  ViewMode,
  SortBy,
  SortOrder,
  Theme,
  AccentColor,
  EditorMode,
  SidebarPanel,
} from '@renderer/specs';

// Re-export types from specs
export type {
  EditorMode,
  AccentColor,
  ViewMode,
  SortBy,
  SortOrder,
  Theme,
  SidebarPanel,
};

// Map accent colors with display names (uses hues from specs)
export const ACCENT_COLORS: Record<AccentColor, { name: string; hue: number }> = {
  blue: { name: 'Blue', hue: tokens.accentHues.blue },
  purple: { name: 'Purple', hue: tokens.accentHues.purple },
  pink: { name: 'Pink', hue: tokens.accentHues.pink },
  red: { name: 'Red', hue: tokens.accentHues.red },
  orange: { name: 'Orange', hue: tokens.accentHues.orange },
  green: { name: 'Green', hue: tokens.accentHues.green },
  teal: { name: 'Teal', hue: tokens.accentHues.teal },
};

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  sidebarPanel: SidebarPanel;

  // Note list
  noteListWidth: number;
  viewMode: ViewMode;
  sortBy: SortBy;
  sortOrder: SortOrder;
  showArchived: boolean;

  // Editor
  editorFullscreen: boolean;
  showPreview: boolean;
  showOutline: boolean;
  showBlockIndicators: boolean;
  editorMode: EditorMode;

  // Search
  searchQuery: string;

  // Modals
  settingsOpen: boolean;
  exportModalOpen: boolean;
  importModalOpen: boolean;
  commandCenterOpen: boolean;
  findReplaceOpen: boolean;

  // Actions
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setSidebarPanel: (panel: SidebarPanel) => void;
  setNoteListWidth: (width: number) => void;
  setViewMode: (mode: ViewMode) => void;
  setSortBy: (sort: SortBy) => void;
  toggleSortOrder: () => void;
  toggleShowArchived: () => void;
  toggleEditorFullscreen: () => void;
  togglePreview: () => void;
  toggleOutline: () => void;
  toggleBlockIndicators: () => void;
  toggleEditorMode: () => void;
  setEditorMode: (mode: EditorMode) => void;
  setSearchQuery: (query: string) => void;
  openSettings: () => void;
  closeSettings: () => void;
  openExportModal: () => void;
  closeExportModal: () => void;
  openImportModal: () => void;
  closeImportModal: () => void;
  openCommandCenter: () => void;
  closeCommandCenter: () => void;
  toggleCommandCenter: () => void;
  openFindReplace: () => void;
  closeFindReplace: () => void;
  toggleFindReplace: () => void;
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
      editorMode: 'rich',

      // Search
      searchQuery: '',

      // Modals
      settingsOpen: false,
      exportModalOpen: false,
      importModalOpen: false,
      commandCenterOpen: false,
      findReplaceOpen: false,

      // Actions
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(400, width)) }),

      setSidebarPanel: (panel) => set({ sidebarPanel: panel }),

      setNoteListWidth: (width) => set({ noteListWidth: Math.max(280, Math.min(480, width)) }),

      setViewMode: (mode) => set({ viewMode: mode }),

      setSortBy: (sort) => set({ sortBy: sort }),

      toggleSortOrder: () =>
        set((state) => ({ sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc' })),

      toggleShowArchived: () => set((state) => ({ showArchived: !state.showArchived })),

      toggleEditorFullscreen: () => set((state) => ({ editorFullscreen: !state.editorFullscreen })),

      togglePreview: () => set((state) => ({ showPreview: !state.showPreview })),

      toggleOutline: () => set((state) => ({ showOutline: !state.showOutline })),

      toggleBlockIndicators: () =>
        set((state) => ({ showBlockIndicators: !state.showBlockIndicators })),

      toggleEditorMode: () =>
        set((state) => ({ editorMode: state.editorMode === 'rich' ? 'raw' : 'rich' })),

      setEditorMode: (mode) => set({ editorMode: mode }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      openSettings: () => set({ settingsOpen: true }),

      closeSettings: () => set({ settingsOpen: false }),

      openExportModal: () => set({ exportModalOpen: true }),

      closeExportModal: () => set({ exportModalOpen: false }),

      openImportModal: () => set({ importModalOpen: true }),

      closeImportModal: () => set({ importModalOpen: false }),

      openCommandCenter: () => set({ commandCenterOpen: true }),

      closeCommandCenter: () => set({ commandCenterOpen: false }),

      toggleCommandCenter: () => set((state) => ({ commandCenterOpen: !state.commandCenterOpen })),

      openFindReplace: () => set({ findReplaceOpen: true }),

      closeFindReplace: () => set({ findReplaceOpen: false }),

      toggleFindReplace: () => set((state) => ({ findReplaceOpen: !state.findReplaceOpen })),
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
        editorMode: state.editorMode,
      }),
    },
  ),
);
