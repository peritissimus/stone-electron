/**
 * Stone UI Specifications
 *
 * Language-agnostic definitions for:
 * - Design tokens (spacing, colors, typography)
 * - Entity shapes (Note, Tag, Notebook, etc.)
 * - Store contracts (state + actions)
 * - Component contracts (props + events)
 * - API contracts (method signatures)
 *
 * These specs can be implemented in any language/framework:
 * - TypeScript/React (current)
 * - Swift/SwiftUI
 * - Kotlin/Compose
 * - Dart/Flutter
 * - Rust/Tauri
 *
 * Usage:
 * ```typescript
 * import { tokens, entities, stores, components, api } from '@/specs';
 *
 * // Use token values
 * const padding = tokens.spacing.md; // 16
 *
 * // Implement a store
 * const noteStore: stores.NoteStoreState = { ... };
 *
 * // Type a component
 * function ListItem(props: components.ListItemProps) { ... }
 * ```
 */

// =============================================================================
// TOKENS
// =============================================================================

export * as tokens from './tokens';
export type { SizeVariant } from './tokens';

// =============================================================================
// ENTITIES
// =============================================================================

export * as entities from './entities';
export type {
  UUID,
  UnixTimestamp,
  FilePath,
  Workspace,
  Note,
  NoteWithRelations,
  Notebook,
  NotebookWithCount,
  Tag,
  TagWithCount,
  TagSummary,
  Topic,
  TopicWithCount,
  TopicSummary,
  Attachment,
  NoteVersion,
  TodoItem,
  TodoState,
  SearchResult,
  GraphNode,
  GraphLink,
  GraphEdge,
  GraphData,
  FileTreeNode,
  FileTreeNodeType,
} from './entities';

// =============================================================================
// STORES
// =============================================================================

export * as stores from './stores';
export type {
  BaseStoreState,
  ListStore,
  SingleSelectStore,
  MultiSelectStore,
  NoteStoreState,
  NotebookStoreState,
  TagStoreState,
  TopicStoreState,
  WorkspaceStoreState,
  FileTreeStoreState,
  UIStoreState,
  DocumentBuffer,
  DocumentBufferStoreState,
  ViewMode,
  SortBy,
  SortOrder,
  Theme,
  AccentColor,
  EditorMode,
  SidebarPanel,
  ActivePage,
} from './stores';

// =============================================================================
// COMPONENTS
// =============================================================================

export * as components from './components';
export type {
  Slot,
  Handler,
  // Layout
  HeaderProps,
  SidebarPanelProps,
  ResizablePanelProps,
  MainContentAreaProps,
  // List
  ListContainerProps,
  ListItemProps,
  CompactCardProps,
  // Tree
  TreeItemProps,
  // Navigation
  QuickLinkProps,
  SectionHeaderProps,
  // Buttons
  IconButtonProps,
  ToolbarButtonProps,
  ControlGroupProps,
  // Form
  InputModalProps,
  // Note
  NoteListProps,
  NoteListItemProps,
  NoteEditorProps,
  NoteHeaderProps,
  // Notebook
  NotebookTreeProps,
  FolderItemProps,
  // Tag
  TagListProps,
  TagBadgeProps,
  // File Tree
  FileTreeProps,
  FileTreeItemProps,
  // Todo
  TodoListProps,
  TodoItemProps,
  // Settings
  SettingsSectionProps,
  SettingsRowProps,
  // Modal
  ModalLayoutProps,
  TabbedModalProps,
  // Command
  CommandCenterProps,
  CommandItem,
} from './components';

// =============================================================================
// API
// =============================================================================

export * as api from './api';
export type {
  Result,
  NoteFilters,
  NoteAPI,
  NotebookFilters,
  NotebookAPI,
  TagAPI,
  TopicAPI,
  WorkspaceAPI,
  AttachmentAPI,
  SearchParams,
  SearchAPI,
  SettingsAPI,
  DatabaseStatus,
  DatabaseAPI,
  SystemAPI,
  API,
} from './api';
