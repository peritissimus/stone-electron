/**
 * Entity Definitions - Core data shapes
 *
 * Specification Layer - Language-agnostic reference for cross-platform development.
 * Plain interfaces that define what data looks like.
 * No ORM, no framework - just shapes.
 *
 * Usage:
 *   - Swift/Kotlin/Flutter developers: replicate these interfaces
 *   - TypeScript implementation: see src/shared/types/ (Drizzle-inferred)
 *
 * These specs serve as the canonical reference. Implementation types may
 * differ slightly (e.g., Date vs UnixTimestamp, snake_case vs camelCase).
 */

// =============================================================================
// PRIMITIVES
// =============================================================================

export type UUID = string;
export type UnixTimestamp = number;
export type FilePath = string;

// =============================================================================
// WORKSPACE
// =============================================================================

export interface Workspace {
  id: UUID;
  name: string;
  path: FilePath;
  isDefault: boolean;
  createdAt: UnixTimestamp;
  updatedAt: UnixTimestamp;
}

// =============================================================================
// NOTE
// =============================================================================

export interface Note {
  id: UUID;
  title: string;
  filePath: FilePath | null;
  notebookId: UUID | null;
  workspaceId: UUID | null;

  // Flags
  isFavorite: boolean;
  isPinned: boolean;
  isArchived: boolean;
  isJournal: boolean;

  // Timestamps
  createdAt: UnixTimestamp;
  updatedAt: UnixTimestamp;
}

export interface NoteWithRelations extends Note {
  tags?: TagSummary[];
  topics?: TopicSummary[];
}

// =============================================================================
// NOTEBOOK (Folder)
// =============================================================================

export interface Notebook {
  id: UUID;
  name: string;
  parentId: UUID | null;
  workspaceId: UUID | null;
  path: FilePath | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  createdAt: UnixTimestamp;
  updatedAt: UnixTimestamp;
}

export interface NotebookWithCount extends Notebook {
  noteCount: number;
}

// =============================================================================
// TAG
// =============================================================================

export interface Tag {
  id: UUID;
  name: string;
  color: string | null;
  createdAt: UnixTimestamp;
}

export interface TagWithCount extends Tag {
  noteCount: number;
}

export interface TagSummary {
  id: UUID;
  name: string;
  color: string | null;
}

// =============================================================================
// TOPIC
// =============================================================================

export interface Topic {
  id: UUID;
  name: string;
  color: string | null;
  description: string | null;
  isPredefined: boolean;
  createdAt: UnixTimestamp;
}

export interface TopicWithCount extends Topic {
  noteCount: number;
}

export interface TopicSummary {
  id: UUID;
  name: string;
  color: string | null;
  confidence: number;
}

// =============================================================================
// ATTACHMENT
// =============================================================================

export interface Attachment {
  id: UUID;
  noteId: UUID;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: FilePath;
  createdAt: UnixTimestamp;
}

// =============================================================================
// NOTE VERSION
// =============================================================================

export interface NoteVersion {
  id: UUID;
  noteId: UUID;
  title: string;
  createdAt: UnixTimestamp;
}

// =============================================================================
// TODO ITEM (extracted from notes)
// =============================================================================

export type TodoState = 'todo' | 'doing' | 'waiting' | 'hold' | 'done' | 'canceled' | 'idea';

export interface TodoItem {
  id: string;
  noteId: UUID;
  noteTitle: string | null;
  notePath: FilePath | null;
  text: string;
  state: TodoState;
  checked: boolean;
}

// =============================================================================
// SEARCH
// =============================================================================

export interface SearchResult {
  id: UUID;
  title: string;
  notebookId: UUID | null;
  score?: number;
  highlight?: string;
  searchType?: 'fts' | 'semantic' | 'hybrid';
}

// =============================================================================
// GRAPH
// =============================================================================

export interface GraphNode {
  id: string;
  name: string;
  val: number;
  color?: string;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// Legacy alias for backwards compatibility
export type GraphEdge = GraphLink;

// =============================================================================
// FILE TREE
// =============================================================================

export type FileTreeNodeType = 'folder' | 'file';

export interface FileTreeNode {
  name: string;
  path: FilePath;
  type: FileTreeNodeType;
  children?: FileTreeNode[];
  noteId?: UUID;
}
