/**
 * UI Hook - React hooks for UI state access
 *
 * Components should use these hooks instead of importing useUIStore directly.
 * This provides a clean interface and allows for future optimizations like
 * granular selectors.
 */

import { useUIStore, ACCENT_COLORS } from '@renderer/stores/uiStore';
import { useSettingsStore } from '@renderer/stores/settingsStore';
import type {
  ViewMode,
  SortBy,
  Theme,
  AccentColor,
  EditorMode,
  SidebarPanel,
} from '@renderer/stores/uiStore';

export { ACCENT_COLORS };

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
  const theme = useSettingsStore((s) => s.appearance.theme);
  const accentColor = useSettingsStore((s) => s.appearance.accentColor);
  const fontSettings = useSettingsStore((s) => s.appearance.fontSettings);

  // Actions - using stable references from store
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const setSidebarPanel = useUIStore((s) => s.setSidebarPanel);
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
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setAccentColor = useSettingsStore((s) => s.setAccentColor);
  const setFontSettings = useSettingsStore((s) => s.setFontSettings);
  const resetFontSettings = useSettingsStore((s) => s.resetFontSettings);

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
    viewMode,
    sortBy,
    sortOrder,
    showArchived,
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
  const viewMode = useUIStore((s) => s.viewMode);
  const sortBy = useUIStore((s) => s.sortBy);
  const sortOrder = useUIStore((s) => s.sortOrder);
  const showArchived = useUIStore((s) => s.showArchived);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const setSortBy = useUIStore((s) => s.setSortBy);
  const toggleSortOrder = useUIStore((s) => s.toggleSortOrder);
  const toggleShowArchived = useUIStore((s) => s.toggleShowArchived);

  return {
    viewMode,
    sortBy,
    sortOrder,
    showArchived,
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
  const theme = useSettingsStore((s) => s.appearance.theme);
  const accentColor = useSettingsStore((s) => s.appearance.accentColor);
  const fontSettings = useSettingsStore((s) => s.appearance.fontSettings);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setAccentColor = useSettingsStore((s) => s.setAccentColor);
  const setFontSettings = useSettingsStore((s) => s.setFontSettings);
  const resetFontSettings = useSettingsStore((s) => s.resetFontSettings);

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
