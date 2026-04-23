/**
 * Component Contracts - Props, slots, and behavior
 *
 * Defines what each component accepts and emits.
 * Framework-specific implementations map these to:
 * - React: props + children
 * - Vue: props + slots + emits
 * - SwiftUI: View protocol + @Binding
 * - Compose: @Composable parameters
 */

import type { SizeVariant } from './tokens';
import type { Note, Notebook, Tag, FileTreeNode, TodoItem } from './entities';
import type { ViewMode } from './stores';

// =============================================================================
// COMMON TYPES
// =============================================================================

/** Generic slot/children type - framework maps this appropriately */
export type Slot = unknown; // React: ReactNode, Vue: VNode, SwiftUI: some View

/** Event handler type */
export type Handler<T = void> = (value: T) => void;

// =============================================================================
// LAYOUT COMPONENTS
// =============================================================================

export interface HeaderProps {
  size?: SizeVariant;
  left?: Slot;
  right?: Slot;
}

export interface SidebarPanelProps {
  width: number;
  minWidth?: number;
  maxWidth?: number;
  onWidthChange?: Handler<number>;
  children: Slot;
}

export interface ResizablePanelProps {
  width: number;
  minWidth: number;
  maxWidth: number;
  side: 'left' | 'right';
  onWidthChange: Handler<number>;
  children: Slot;
}

export interface MainContentAreaProps {
  children: Slot;
}

export interface SpacerProps {
  size?: SizeVariant;
  direction?: 'horizontal' | 'vertical';
}

export interface PanelFooterProps {
  size?: SizeVariant;
  left?: Slot;
  right?: Slot;
  children?: Slot;
}

export interface SidebarProps {
  width: number;
  minWidth?: number;
  maxWidth?: number;
  collapsed?: boolean;
  onWidthChange?: Handler<number>;
  onToggleCollapse?: Handler;
  header?: Slot;
  footer?: Slot;
  children: Slot;
}

// =============================================================================
// LIST COMPONENTS
// =============================================================================

export interface ListContainerProps {
  viewMode: ViewMode;
  children: Slot;
}

export interface ListItemProps {
  size?: SizeVariant;
  isActive?: boolean;
  left?: Slot;
  right?: Slot;
  title?: string;
  subtitle?: string;
  onClick?: Handler;
  children?: Slot; // alternative to title/subtitle
}

export interface CompactCardProps {
  size?: SizeVariant;
  isActive?: boolean;
  title: string;
  subtitle?: string;
  icon?: Slot;
  onClick?: Handler;
}

// =============================================================================
// TREE COMPONENTS
// =============================================================================

export interface TreeItemProps {
  size?: SizeVariant;
  level: number; // indentation level (0, 1, 2...)
  isActive?: boolean;
  isExpanded?: boolean;
  hasChildren?: boolean;
  left?: Slot;
  right?: Slot;
  title: string;
  onClick?: Handler;
  onToggle?: Handler;
}

// =============================================================================
// NAVIGATION COMPONENTS
// =============================================================================

export interface QuickLinkProps {
  size?: SizeVariant;
  isActive?: boolean;
  icon: Slot;
  label: string;
  badge?: string | number;
  onClick?: Handler;
}

export interface SectionHeaderProps {
  size?: SizeVariant;
  title: string;
  action?: Slot;
  collapsible?: boolean;
  isCollapsed?: boolean;
  onToggle?: Handler;
}

// =============================================================================
// BUTTON COMPONENTS
// =============================================================================

export interface IconButtonProps {
  size?: SizeVariant;
  icon: Slot;
  tooltip?: string;
  disabled?: boolean;
  onClick?: Handler;
}

export interface ToolbarButtonProps {
  size?: SizeVariant;
  isActive?: boolean;
  icon: Slot;
  tooltip?: string;
  onClick?: Handler;
}

export interface ControlGroupProps {
  gap?: 'xs' | 'sm' | 'md';
  background?: boolean;
  children: Slot;
}

// =============================================================================
// FORM COMPONENTS
// =============================================================================

export interface InputModalProps {
  open: boolean;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  onSubmit: Handler<string>;
  onCancel: Handler;
}

// =============================================================================
// NOTE COMPONENTS
// =============================================================================

export interface NoteListProps {
  notes: Note[];
  activeNoteId?: string;
  viewMode: ViewMode;
  onSelect: Handler<Note>;
  onDelete?: Handler<Note>;
  onToggleFavorite?: Handler<Note>;
  onTogglePin?: Handler<Note>;
}

export interface NoteListItemProps {
  note: Note;
  isActive: boolean;
  onClick: Handler;
  onContextMenu?: Handler;
}

export interface NoteEditorProps {
  noteId: string;
  content: string;
  editable?: boolean;
  onChange: Handler<string>;
  onSave?: Handler;
}

export interface NoteHeaderProps {
  title: string;
  isFavorite: boolean;
  isPinned: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  onTitleChange: Handler<string>;
  onSave: Handler;
  onToggleFavorite: Handler;
  onTogglePin: Handler;
}

// =============================================================================
// NOTEBOOK/FOLDER COMPONENTS
// =============================================================================

export interface NotebookTreeProps {
  notebooks: Notebook[];
  activeNotebookId?: string;
  expandedIds: Set<string>;
  onSelect: Handler<Notebook>;
  onToggle: Handler<string>;
  onCreate?: Handler<string | null>; // parentId
  onRename?: Handler<Notebook>;
  onDelete?: Handler<Notebook>;
}

export interface FolderItemProps {
  notebook: Notebook;
  level: number;
  isActive: boolean;
  isExpanded: boolean;
  noteCount: number;
  onClick: Handler;
  onToggle: Handler;
}

// =============================================================================
// TAG COMPONENTS
// =============================================================================

export interface TagListProps {
  tags: Tag[];
  selectedIds: string[];
  onSelect: Handler<Tag>;
  onDeselect: Handler<Tag>;
  onCreate?: Handler<string>;
}

export interface TagBadgeProps {
  tag: Tag;
  removable?: boolean;
  onClick?: Handler;
  onRemove?: Handler;
}

// =============================================================================
// FILE TREE COMPONENTS
// =============================================================================

export interface FileTreeProps {
  tree: FileTreeNode[];
  activePath?: string;
  expandedPaths: Set<string>;
  onSelect: Handler<FileTreeNode>;
  onToggle: Handler<string>;
}

export interface FileTreeItemProps {
  node: FileTreeNode;
  level: number;
  isActive: boolean;
  isExpanded: boolean;
  onClick: Handler;
  onToggle: Handler;
}

// =============================================================================
// TODO COMPONENTS
// =============================================================================

export interface TodoListProps {
  todos: TodoItem[];
  groupBy?: 'note' | 'state' | 'none';
  onToggle: Handler<TodoItem>;
  onNavigate: Handler<TodoItem>;
}

export interface TodoItemProps {
  todo: TodoItem;
  showNoteName?: boolean;
  onToggle: Handler;
  onClick?: Handler;
}

// =============================================================================
// SETTINGS COMPONENTS
// =============================================================================

export interface SettingsSectionProps {
  title: string;
  description?: string;
  children: Slot;
}

export interface SettingsRowProps {
  label: string;
  description?: string;
  children: Slot; // the control (switch, select, etc.)
}

// =============================================================================
// MODAL COMPONENTS
// =============================================================================

export interface ModalLayoutProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: Handler;
  children: Slot;
  footer?: Slot;
}

export interface TabbedModalProps {
  open: boolean;
  title: string;
  tabs: Array<{
    id: string;
    label: string;
    icon?: Slot;
    content: Slot;
  }>;
  activeTab: string;
  onTabChange: Handler<string>;
  onClose: Handler;
}

// =============================================================================
// COMMAND CENTER
// =============================================================================

export interface CommandCenterProps {
  open: boolean;
  onClose: Handler;
  onSelect: Handler<CommandItem>;
}

export interface CommandItem {
  id: string;
  type: 'note' | 'command' | 'folder';
  title: string;
  subtitle?: string;
  icon?: Slot;
  shortcut?: string;
  action: Handler;
}

export interface CommandItemRowProps {
  item: CommandItem;
  index: number;
  isSelected: boolean;
  onClick: Handler;
  onMouseEnter: Handler;
}
