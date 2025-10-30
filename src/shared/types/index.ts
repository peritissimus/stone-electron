/**
 * Shared Types for Stone Application
 */

// IDs
export type UUID = string & { readonly __brand: 'UUID' }

// Timestamps
export type UnixTimestamp = number

// Note Types
export interface Note {
  id: UUID
  title: string
  content: string
  notebookId: UUID | null
  isFavorite: number
  isPinned: number
  isArchived: number
  isDeleted: number
  deletedAt: UnixTimestamp | null
  createdAt: UnixTimestamp
  updatedAt: UnixTimestamp
  [key: string]: unknown
}

export interface NoteVersion {
  id: UUID
  noteId: UUID
  title: string
  content: string
  versionNumber: number
  createdAt: UnixTimestamp
  [key: string]: unknown
}

// Notebook Types
export interface Notebook {
  id: UUID
  name: string
  icon: string
  color: string
  parentId: UUID | null
  position: number
  createdAt: UnixTimestamp
  updatedAt: UnixTimestamp
  [key: string]: unknown
}

// Tag Types
export interface Tag {
  id: UUID
  name: string
  color: string
  createdAt: UnixTimestamp
  [key: string]: unknown
}

export interface NoteTag {
  noteId: UUID
  tagId: UUID
}

// Attachment Types
export interface Attachment {
  id: UUID
  noteId: UUID
  filename: string
  filepath: string
  mimetype: string
  size: number
  createdAt: UnixTimestamp
  [key: string]: unknown
}

// Link Types
export interface NoteLink {
  source_noteId: UUID
  target_noteId: UUID
  createdAt: UnixTimestamp
}

// Settings
export interface Settings {
  key: string
  value: string
  updatedAt: UnixTimestamp
}

// Migration Types
export interface Migration {
  version: number
  name: string
  appliedAt: UnixTimestamp
  checksum: string
}

// API Request/Response Types
export interface IpcResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

// Search Types
export interface SearchResult {
  id: UUID
  title: string
  content: string
  notebookId: UUID | null
  relevance: number
  createdAt: UnixTimestamp
}

export interface VectorSearchResult extends SearchResult {
  similarity: number
}

// Backup Types
export interface BackupMetadata {
  version: string
  timestamp: UnixTimestamp
  databaseVersion: number
  noteCount: number
  databaseSize: number
  vectorSize: number
  attachmentSize: number
  checksum: string
}

// Database Status
export interface DatabaseStatus {
  version: number
  isMigrating: boolean
  noteCount: number
  notebookCount: number
  tagCount: number
  attachmentCount: number
  databaseSize: number
  vectorSize: number
  lastBackup?: UnixTimestamp
  lastDefrag?: UnixTimestamp
  integrityOk: boolean
  error?: string
}

// Error Types
export interface AppError {
  code: string
  message: string
  details?: unknown
  timestamp: UnixTimestamp
}
