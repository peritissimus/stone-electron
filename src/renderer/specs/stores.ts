/**
 * Store Contracts - State shape and actions
 *
 * Defines what state each store holds and what actions it supports.
 * Implementation can be Zustand (React), Pinia (Vue), MobX, Redux,
 * SwiftUI @Observable, Kotlin StateFlow, etc.
 */

import type {
  Note,
  NoteWithRelations,
  Notebook,
  NotebookWithCount,
  Tag,
  TagWithCount,
  Topic,
  TopicWithCount,
  Workspace,
  FileTreeNode,
  UUID,
  FilePath,
} from './entities';
import type { SizeVariant } from './tokens';

// =============================================================================
// COMMON PATTERNS
// =============================================================================

/** Base state that all stores share */
export interface BaseStoreState {
  loading: boolean;
  error: string | null;
  setLoading(loading: boolean): void;
  setError(error: string | null): void;
}

/** Store with a list of items */
export interface ListStore<T> extends BaseStoreState {
  items: T[];
  setItems(items: T[]): void;
  addItem(item: T): void;
  updateItem(item: T): void;
  deleteItem(id: string): void;
}

/** Store with single selection */
export interface SingleSelectStore<T> extends ListStore<T> {
  selectedId: string | null;
  selectItem(id: string | null): void;
  getSelectedItem(): T | null;
}

/** Store with multi selection */
export interface MultiSelectStore<T> extends ListStore<T> {
  selectedIds: string[];
  selectItem(id: string): void;
  deselectItem(id: string): void;
  toggleItem(id: string): void;
  clearSelection(): void;
  getSelectedItems(): T[];
}

// =============================================================================
// NOTE STORE
// =============================================================================

export interface NoteStoreState extends BaseStoreState {
  notes: Note[];
  activeNoteId: UUID | null;

  // Actions
  setNotes(notes: Note[]): void;
  addNote(note: Note): void;
  updateNote(note: Note): void;
  deleteNote(id: UUID): void;
  setActiveNote(id: UUID | null): void;

  // Queries
  getActiveNote(): Note | null;
  getNotesByNotebook(notebookId: UUID): Note[];
  getNoteByFilePath(filePath: FilePath): Note | null;
  getFavoriteNotes(): Note[];
  getPinnedNotes(): Note[];
  getArchivedNotes(): Note[];
}

// =============================================================================
// NOTEBOOK STORE
// =============================================================================

export interface NotebookStoreState extends BaseStoreState {
  notebooks: NotebookWithCount[];
  activeNotebookId: UUID | null;
  expandedIds: Set<UUID>;

  // Actions
  setNotebooks(notebooks: NotebookWithCount[]): void;
  addNotebook(notebook: NotebookWithCount): void;
  updateNotebook(notebook: NotebookWithCount): void;
  deleteNotebook(id: UUID): void;
  setActiveNotebook(id: UUID | null): void;
  toggleExpanded(id: UUID): void;
  setExpanded(id: UUID, expanded: boolean): void;

  // Queries
  getActiveNotebook(): NotebookWithCount | null;
  getChildren(parentId: UUID | null): NotebookWithCount[];
  isExpanded(id: UUID): boolean;
}

// =============================================================================
// TAG STORE
// =============================================================================

export interface TagStoreState extends MultiSelectStore<TagWithCount> {
  // Already has: items, selectedIds, loading, error
  // Already has: setItems, addItem, updateItem, deleteItem
  // Already has: selectItem, deselectItem, toggleItem, clearSelection
}

// =============================================================================
// TOPIC STORE
// =============================================================================

export interface TopicStoreState extends SingleSelectStore<TopicWithCount> {
  // Already has: items, selectedId, loading, error
  // Already has: setItems, addItem, updateItem, deleteItem, selectItem
}

// =============================================================================
// WORKSPACE STORE
// =============================================================================

export interface WorkspaceStoreState extends BaseStoreState {
  workspaces: Workspace[];
  activeWorkspaceId: UUID | null;

  // Actions
  setWorkspaces(workspaces: Workspace[]): void;
  addWorkspace(workspace: Workspace): void;
  setActiveWorkspace(id: UUID | null): void;

  // Queries
  getActiveWorkspace(): Workspace | null;
}

// =============================================================================
// FILE TREE STORE
// =============================================================================

export interface FileTreeStoreState extends BaseStoreState {
  tree: FileTreeNode[];
  expandedPaths: Set<FilePath>;
  activePath: FilePath | null;

  // Actions
  setTree(tree: FileTreeNode[]): void;
  toggleExpanded(path: FilePath): void;
  setActivePath(path: FilePath | null): void;
  expandToPath(path: FilePath): void;

  // Queries
  isExpanded(path: FilePath): boolean;
  getNodeByPath(path: FilePath): FileTreeNode | null;
}

// =============================================================================
// UI STORE
// =============================================================================

export type ViewMode = 'list' | 'grid' | 'card';
export type SortBy = 'updated' | 'created' | 'title' | 'favorite';
export type SortOrder = 'asc' | 'desc';
export type Theme = 'light' | 'dark' | 'system';
export type AccentColor = 'blue' | 'purple' | 'pink' | 'red' | 'orange' | 'green' | 'teal';
export type EditorMode = 'rich' | 'raw';
export type SidebarPanel = 'home' | 'folders' | 'tags' | 'search';
export type ActivePage = 'home' | 'tasks' | 'graph' | 'topics';

export interface UIStoreState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarWidth: number;
  sidebarPanel: SidebarPanel;

  // Note list
  viewMode: ViewMode;
  sortBy: SortBy;
  sortOrder: SortOrder;
  showArchived: boolean;

  // Editor
  editorMode: EditorMode;
  showOutline: boolean;

  // Modals
  settingsOpen: boolean;
  commandCenterOpen: boolean;

  // Theme
  theme: Theme;
  accentColor: AccentColor;

  // Navigation
  activePage: ActivePage;

  // Actions
  toggleSidebar(): void;
  setSidebarWidth(width: number): void;
  setSidebarPanel(panel: SidebarPanel): void;
  setViewMode(mode: ViewMode): void;
  setSortBy(sort: SortBy): void;
  toggleSortOrder(): void;
  toggleShowArchived(): void;
  toggleEditorMode(): void;
  setEditorMode(mode: EditorMode): void;
  openSettings(): void;
  closeSettings(): void;
  toggleCommandCenter(): void;
  setTheme(theme: Theme): void;
  setAccentColor(color: AccentColor): void;
  setActivePage(page: ActivePage): void;
}

// =============================================================================
// DOCUMENT BUFFER STORE (for unsaved changes)
// =============================================================================

export interface DocumentBuffer {
  noteId: UUID;
  content: string;
  isDirty: boolean;
  lastSaved: number | null;
}

export interface DocumentBufferStoreState {
  buffers: Map<UUID, DocumentBuffer>;

  // Actions
  setBuffer(noteId: UUID, content: string): void;
  markClean(noteId: UUID): void;
  markDirty(noteId: UUID): void;
  removeBuffer(noteId: UUID): void;
  clearAll(): void;

  // Queries
  getBuffer(noteId: UUID): DocumentBuffer | null;
  isDirty(noteId: UUID): boolean;
  hasUnsavedChanges(): boolean;
  getDirtyNoteIds(): UUID[];
}
