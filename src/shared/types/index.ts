/**
 * Shared Types for Stone Application
 */

import {
  workspaces,
  notes,
  notebooks,
  tags,
  noteTags,
  noteLinks,
  attachments,
  noteVersions,
} from '@main/database/schema';

// IDs
export type UUID = string & { readonly __brand: 'UUID' };

// Timestamps
export type UnixTimestamp = number;

// Infer types from Drizzle schema
export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = typeof workspaces.$inferInsert;

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;

export type Notebook = typeof notebooks.$inferSelect;
export type InsertNotebook = typeof notebooks.$inferInsert;

export interface NotebookWithCount extends Notebook {
  note_count: number;
}

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

export interface TagWithCount extends Tag {
  note_count: number;
}
export type NoteTag = typeof noteTags.$inferSelect;
export type InsertNoteTag = typeof noteTags.$inferInsert;

export type NoteLink = typeof noteLinks.$inferSelect;
export type InsertNoteLink = typeof noteLinks.$inferInsert;

export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = typeof attachments.$inferInsert;

export type NoteVersion = typeof noteVersions.$inferSelect;
export type InsertNoteVersion = typeof noteVersions.$inferInsert;

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

// Database Status
export interface DatabaseStatus {
  version: number;
  isMigrating: boolean;
  noteCount: number;
  notebookCount: number;
  tagCount: number;
  attachmentCount: number;
  databaseSize: number;
  vectorSize: number;
  lastBackup?: UnixTimestamp;
  lastDefrag?: UnixTimestamp;
  integrityOk: boolean;
  error?: string;
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
  foreign_keys_ok: boolean;
  errors: string[];
  warnings: string[];
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
