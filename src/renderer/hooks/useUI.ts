/**
 * UI Hook - React hooks for UI state access
 *
 * Components should use these hooks instead of importing useUIStore directly.
 * This provides a clean interface and allows for future optimizations like
 * granular selectors.
 */

import { useUIStore } from '@renderer/stores/uiStore';
import type {
  ViewMode,
  SortBy,
  Theme,
  AccentColor,
  EditorMode,
  SidebarPanel,
} from '@renderer/stores/uiStore';

/**
 * Main UI hook - provides access to all UI state and actions
 */
export function useUI() {
  // Sidebar state
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const sidebarPanel = useUIStore((s) => s.sidebarPanel);

  // Note list state
  const noteListWidth = useUIStore((s) => s.noteListWidth);
  const viewMode = useUIStore((s) => s.viewMode);
  const sortBy = useUIStore((s) => s.sortBy);
  const sortOrder = useUIStore((s) => s.sortOrder);
  const showArchived = useUIStore((s) => s.showArchived);

  // Editor state
  const editorFullscreen = useUIStore((s) => s.editorFullscreen);
  const showPreview = useUIStore((s) => s.showPreview);
  const showOutline = useUIStore((s) => s.showOutline);
  const showBlockIndicators = useUIStore((s) => s.showBlockIndicators);
  const editorMode = useUIStore((s) => s.editorMode);

  // Search state
  const searchQuery = useUIStore((s) => s.searchQuery);

  // Modal state
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const exportModalOpen = useUIStore((s) => s.exportModalOpen);
  const importModalOpen = useUIStore((s) => s.importModalOpen);
  const commandCenterOpen = useUIStore((s) => s.commandCenterOpen);
  const findReplaceOpen = useUIStore((s) => s.findReplaceOpen);

  // Theme state
  const theme = useUIStore((s) => s.theme);
  const accentColor = useUIStore((s) => s.accentColor);
  const fontSettings = useUIStore((s) => s.fontSettings);

  // Actions - using stable references from store
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const setSidebarPanel = useUIStore((s) => s.setSidebarPanel);
  const setNoteListWidth = useUIStore((s) => s.setNoteListWidth);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const setSortBy = useUIStore((s) => s.setSortBy);
  const toggleSortOrder = useUIStore((s) => s.toggleSortOrder);
  const toggleShowArchived = useUIStore((s) => s.toggleShowArchived);
  const toggleEditorFullscreen = useUIStore((s) => s.toggleEditorFullscreen);
  const togglePreview = useUIStore((s) => s.togglePreview);
  const toggleOutline = useUIStore((s) => s.toggleOutline);
  const toggleBlockIndicators = useUIStore((s) => s.toggleBlockIndicators);
  const toggleEditorMode = useUIStore((s) => s.toggleEditorMode);
  const setEditorMode = useUIStore((s) => s.setEditorMode);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);
  const openSettings = useUIStore((s) => s.openSettings);
  const closeSettings = useUIStore((s) => s.closeSettings);
  const openExportModal = useUIStore((s) => s.openExportModal);
  const closeExportModal = useUIStore((s) => s.closeExportModal);
  const openImportModal = useUIStore((s) => s.openImportModal);
  const closeImportModal = useUIStore((s) => s.closeImportModal);
  const openCommandCenter = useUIStore((s) => s.openCommandCenter);
  const closeCommandCenter = useUIStore((s) => s.closeCommandCenter);
  const toggleCommandCenter = useUIStore((s) => s.toggleCommandCenter);
  const openFindReplace = useUIStore((s) => s.openFindReplace);
  const closeFindReplace = useUIStore((s) => s.closeFindReplace);
  const toggleFindReplace = useUIStore((s) => s.toggleFindReplace);
  const setTheme = useUIStore((s) => s.setTheme);
  const setAccentColor = useUIStore((s) => s.setAccentColor);
  const setFontSettings = useUIStore((s) => s.setFontSettings);
  const resetFontSettings = useUIStore((s) => s.resetFontSettings);

  return {
    // Sidebar
    sidebarOpen,
    sidebarCollapsed,
    sidebarWidth,
    sidebarPanel,
    toggleSidebar,
    setSidebarWidth,
    setSidebarPanel,

    // Note list
    noteListWidth,
    viewMode,
    sortBy,
    sortOrder,
    showArchived,
    setNoteListWidth,
    setViewMode,
    setSortBy,
    toggleSortOrder,
    toggleShowArchived,

    // Editor
    editorFullscreen,
    showPreview,
    showOutline,
    showBlockIndicators,
    editorMode,
    toggleEditorFullscreen,
    togglePreview,
    toggleOutline,
    toggleBlockIndicators,
    toggleEditorMode,
    setEditorMode,

    // Search
    searchQuery,
    setSearchQuery,

    // Modals
    settingsOpen,
    exportModalOpen,
    importModalOpen,
    commandCenterOpen,
    findReplaceOpen,
    openSettings,
    closeSettings,
    openExportModal,
    closeExportModal,
    openImportModal,
    closeImportModal,
    openCommandCenter,
    closeCommandCenter,
    toggleCommandCenter,
    openFindReplace,
    closeFindReplace,
    toggleFindReplace,

    // Theme
    theme,
    accentColor,
    fontSettings,
    setTheme,
    setAccentColor,
    setFontSettings,
    resetFontSettings,
  };
}

/**
 * Sidebar-specific UI hook
 */
export function useSidebarUI() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const sidebarPanel = useUIStore((s) => s.sidebarPanel);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const setSidebarPanel = useUIStore((s) => s.setSidebarPanel);

  return {
    sidebarOpen,
    sidebarCollapsed,
    sidebarWidth,
    sidebarPanel,
    toggleSidebar,
    setSidebarWidth,
    setSidebarPanel,
  };
}

/**
 * Editor-specific UI hook
 */
export function useEditorUI() {
  const editorFullscreen = useUIStore((s) => s.editorFullscreen);
  const showPreview = useUIStore((s) => s.showPreview);
  const showOutline = useUIStore((s) => s.showOutline);
  const showBlockIndicators = useUIStore((s) => s.showBlockIndicators);
  const editorMode = useUIStore((s) => s.editorMode);
  const toggleEditorFullscreen = useUIStore((s) => s.toggleEditorFullscreen);
  const togglePreview = useUIStore((s) => s.togglePreview);
  const toggleOutline = useUIStore((s) => s.toggleOutline);
  const toggleBlockIndicators = useUIStore((s) => s.toggleBlockIndicators);
  const toggleEditorMode = useUIStore((s) => s.toggleEditorMode);
  const setEditorMode = useUIStore((s) => s.setEditorMode);

  return {
    editorFullscreen,
    showPreview,
    showOutline,
    showBlockIndicators,
    editorMode,
    toggleEditorFullscreen,
    togglePreview,
    toggleOutline,
    toggleBlockIndicators,
    toggleEditorMode,
    setEditorMode,
  };
}

/**
 * Note list UI hook
 */
export function useNoteListUI() {
  const noteListWidth = useUIStore((s) => s.noteListWidth);
  const viewMode = useUIStore((s) => s.viewMode);
  const sortBy = useUIStore((s) => s.sortBy);
  const sortOrder = useUIStore((s) => s.sortOrder);
  const showArchived = useUIStore((s) => s.showArchived);
  const setNoteListWidth = useUIStore((s) => s.setNoteListWidth);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const setSortBy = useUIStore((s) => s.setSortBy);
  const toggleSortOrder = useUIStore((s) => s.toggleSortOrder);
  const toggleShowArchived = useUIStore((s) => s.toggleShowArchived);

  return {
    noteListWidth,
    viewMode,
    sortBy,
    sortOrder,
    showArchived,
    setNoteListWidth,
    setViewMode,
    setSortBy,
    toggleSortOrder,
    toggleShowArchived,
  };
}

/**
 * Theme-specific UI hook
 */
export function useTheme() {
  const theme = useUIStore((s) => s.theme);
  const accentColor = useUIStore((s) => s.accentColor);
  const fontSettings = useUIStore((s) => s.fontSettings);
  const setTheme = useUIStore((s) => s.setTheme);
  const setAccentColor = useUIStore((s) => s.setAccentColor);
  const setFontSettings = useUIStore((s) => s.setFontSettings);
  const resetFontSettings = useUIStore((s) => s.resetFontSettings);

  return {
    theme,
    accentColor,
    fontSettings,
    setTheme,
    setAccentColor,
    setFontSettings,
    resetFontSettings,
  };
}

/**
 * Modal state hook
 */
export function useModals() {
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const exportModalOpen = useUIStore((s) => s.exportModalOpen);
  const importModalOpen = useUIStore((s) => s.importModalOpen);
  const commandCenterOpen = useUIStore((s) => s.commandCenterOpen);
  const findReplaceOpen = useUIStore((s) => s.findReplaceOpen);
  const openSettings = useUIStore((s) => s.openSettings);
  const closeSettings = useUIStore((s) => s.closeSettings);
  const openExportModal = useUIStore((s) => s.openExportModal);
  const closeExportModal = useUIStore((s) => s.closeExportModal);
  const openImportModal = useUIStore((s) => s.openImportModal);
  const closeImportModal = useUIStore((s) => s.closeImportModal);
  const openCommandCenter = useUIStore((s) => s.openCommandCenter);
  const closeCommandCenter = useUIStore((s) => s.closeCommandCenter);
  const toggleCommandCenter = useUIStore((s) => s.toggleCommandCenter);
  const openFindReplace = useUIStore((s) => s.openFindReplace);
  const closeFindReplace = useUIStore((s) => s.closeFindReplace);
  const toggleFindReplace = useUIStore((s) => s.toggleFindReplace);

  return {
    settingsOpen,
    exportModalOpen,
    importModalOpen,
    commandCenterOpen,
    findReplaceOpen,
    openSettings,
    closeSettings,
    openExportModal,
    closeExportModal,
    openImportModal,
    closeImportModal,
    openCommandCenter,
    closeCommandCenter,
    toggleCommandCenter,
    openFindReplace,
    closeFindReplace,
    toggleFindReplace,
  };
}

// Re-export types for convenience
export type { ViewMode, SortBy, Theme, AccentColor, EditorMode, SidebarPanel };

// Re-export ActivePage from useAppNavigation (now derived from URL)
export type { AppPage as ActivePage } from './useAppNavigation';
