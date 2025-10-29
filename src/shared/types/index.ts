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
  notebook_id: UUID | null
  is_favorite: number
  is_pinned: number
  is_archived: number
  is_deleted: number
  deleted_at: UnixTimestamp | null
  created_at: UnixTimestamp
  updated_at: UnixTimestamp
  [key: string]: unknown
}

export interface NoteVersion {
  id: UUID
  note_id: UUID
  title: string
  content: string
  version_number: number
  created_at: UnixTimestamp
  [key: string]: unknown
}

// Notebook Types
export interface Notebook {
  id: UUID
  name: string
  icon: string
  color: string
  parent_id: UUID | null
  position: number
  created_at: UnixTimestamp
  updated_at: UnixTimestamp
  [key: string]: unknown
}

// Tag Types
export interface Tag {
  id: UUID
  name: string
  color: string
  created_at: UnixTimestamp
  [key: string]: unknown
}

export interface NoteTag {
  note_id: UUID
  tag_id: UUID
}

// Attachment Types
export interface Attachment {
  id: UUID
  note_id: UUID
  filename: string
  filepath: string
  mimetype: string
  size: number
  created_at: UnixTimestamp
  [key: string]: unknown
}

// Link Types
export interface NoteLink {
  source_note_id: UUID
  target_note_id: UUID
  created_at: UnixTimestamp
}

// Settings
export interface Settings {
  key: string
  value: string
  updated_at: UnixTimestamp
}

// Migration Types
export interface Migration {
  version: number
  name: string
  applied_at: UnixTimestamp
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
  notebook_id: UUID | null
  relevance: number
  created_at: UnixTimestamp
}

export interface VectorSearchResult extends SearchResult {
  similarity: number
}

// Backup Types
export interface BackupMetadata {
  version: string
  timestamp: UnixTimestamp
  database_version: number
  note_count: number
  database_size: number
  vector_size: number
  attachment_size: number
  checksum: string
}

// Database Status
export interface DatabaseStatus {
  version: number
  is_migrating: boolean
  note_count: number
  notebook_count: number
  tag_count: number
  attachment_count: number
  database_size: number
  vector_size: number
  last_backup?: UnixTimestamp
  last_defrag?: UnixTimestamp
  integrity_ok: boolean
  error?: string
}

// Error Types
export interface AppError {
  code: string
  message: string
  details?: unknown
  timestamp: UnixTimestamp
}
