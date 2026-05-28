/**
 * Shared Types for Stone Application
 *
 * Serializable DTO-style types used across main ↔ renderer boundaries.
 * This module intentionally does not import from main, renderer, adapters,
 * infrastructure, or database schema modules.
 */

// IDs
export type UUID = string & { readonly __brand: 'UUID' };

// Timestamps
export type UnixTimestamp = number;

// Entity DTOs
export interface Workspace {
  id: string;
  name: string;
  folderPath: string;
  isActive: boolean;
  createdAt: Date;
  lastAccessedAt: Date;
}

export type InsertWorkspace = Partial<Workspace> & Pick<Workspace, 'id' | 'name' | 'folderPath'>;

export interface Note {
  id: string;
  title: string | null;
  filePath: string | null;
  notebookId: string | null;
  workspaceId: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  deletedAt: Date | null;
  embedding?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertNote = Partial<Note> & Pick<Note, 'id'>;

export interface Notebook {
  id: string;
  name: string;
  parentId: string | null;
  workspaceId: string | null;
  folderPath: string | null;
  icon: string | null;
  color: string | null;
  position: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertNotebook = Partial<Notebook> & Pick<Notebook, 'id' | 'name'>;

export interface NotebookWithCount extends Notebook {
  note_count: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertTag = Partial<Tag> & Pick<Tag, 'id' | 'name'>;

export interface TagWithCount extends Tag {
  note_count: number;
}

export interface NoteTag {
  noteId: string;
  tagId: string;
  createdAt: Date;
}

export type InsertNoteTag = NoteTag;

export interface NoteLink {
  sourceNoteId: string;
  targetNoteId: string;
  createdAt: Date;
}

export type InsertNoteLink = NoteLink;

export interface Topic {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isPredefined: boolean;
  centroid: Uint8Array | null;
  noteCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertTopic = Partial<Topic> & Pick<Topic, 'id' | 'name'>;

export interface TopicWithCount extends Topic {
  noteCount: number;
}

export interface NoteTopic {
  noteId: string;
  topicId: string;
  confidence: number;
  isManual: boolean;
  createdAt: Date;
}

export type InsertNoteTopic = Partial<NoteTopic> & Pick<NoteTopic, 'noteId' | 'topicId'>;

export interface NoteTopicWithDetails extends NoteTopic {
  topicName: string;
  topicColor: string | null;
}

// Classification result from embedding similarity
export interface ClassificationResult {
  topicId: string;
  topicName: string;
  confidence: number;
}

// Similar note result from semantic search
export interface SimilarNote {
  noteId: string;
  title: string;
  distance: number;
}

// Embedding status
export interface EmbeddingStatus {
  ready: boolean;
  totalNotes: number;
  embeddedNotes: number;
  pendingNotes: number;
}

export interface Attachment {
  id: string;
  noteId: string;
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  createdAt: Date;
}

export type InsertAttachment = Attachment;

export interface NoteVersion {
  id: string;
  noteId: string;
  title: string;
  content: string;
  versionNumber: number;
  createdAt: Date;
}

export type InsertNoteVersion = NoteVersion;

// Settings
export interface Settings {
  key: string;
  value: string;
  updatedAt: UnixTimestamp;
}

// Migration Types
export interface Migration {
  version: number;
  name: string;
  appliedAt: UnixTimestamp;
  checksum: string;
}

// API Request/Response Types
export interface IpcResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Todo Types
export interface TodoItem {
  id: string;
  noteId: UUID;
  noteTitle: string | null;
  notePath: string | null;
  text: string;
  state: 'todo' | 'doing' | 'waiting' | 'hold' | 'done' | 'canceled' | 'idea';
  checked: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Search Types
export interface SearchResult {
  id: UUID;
  title: string;
  notebookId: UUID | null;
  relevance?: number;
  similarity?: number;
  score?: number;
  title_highlight?: string;
  search_type?: 'fts' | 'semantic' | 'hybrid';
}

export interface SearchResults {
  results: SearchResult[];
  total: number;
  query_time_ms: number;
}

export interface VectorSearchResult extends SearchResult {
  similarity: number;
}

// Backup Types
export interface BackupMetadata {
  version: string;
  timestamp: UnixTimestamp;
  databaseVersion: number;
  noteCount: number;
  databaseSize: number;
  vectorSize: number;
  attachmentSize: number;
  checksum: string;
}

// Database Status — mirrors DatabaseStatusResponseSchema in
// src/shared/schemas/database.ts.
export interface DatabaseStatus {
  path: string;
  databaseSize: number;
  isOpen: boolean;
  noteCount: number;
  notebookCount: number;
  tagCount: number;
}

// Database Operation Responses
export interface BackupResult {
  size: number;
  path: string;
  timestamp: UnixTimestamp;
}

export interface VacuumResult {
  size_before: number;
  size_after: number;
  freed_bytes: number;
}

export interface IntegrityResult {
  ok: boolean;
  errors: string[];
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: UnixTimestamp;
}

// Export settings types
export * from './settings';

// Export AI wire types
export * from './ai';

// Export topic suggestion wire types
export * from './topicSuggestion';

// Export related-notes wire types
export * from './related';

// Export graph wire types
export * from './graph';

// Export meeting recording wire types
export * from './meeting';

// Export template wire types
export * from './template';
