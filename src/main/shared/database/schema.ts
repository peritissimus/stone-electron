/**
 * Database Schema
 *
 * Shared database schema definitions used by both adapters and infrastructure layers.
 * This is the single source of truth for all table definitions.
 */

import { sqliteTable, text, integer, index, real, blob, primaryKey } from 'drizzle-orm/sqlite-core';

// Workspaces table
export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  folderPath: text('folder_path').notNull().unique(),
  isActive: integer('is_active', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  lastAccessedAt: integer('last_accessed_at', { mode: 'timestamp' }).notNull(),
});

// Notebooks table
export const notebooks = sqliteTable(
  'notebooks',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    parentId: text('parent_id'),
    workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    folderPath: text('folder_path'), // Relative path within workspace
    icon: text('icon').default('📁'),
    color: text('color').default('#3b82f6'),
    position: integer('position').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('idx_notebooks_workspace_id').on(table.workspaceId),
    index('idx_notebooks_folder_path').on(table.folderPath),
    index('idx_notebooks_parent_id').on(table.parentId),
  ],
);

// Notes table
export const notes = sqliteTable(
  'notes',
  {
    id: text('id').primaryKey(),
    title: text('title').default('Untitled'),
    filePath: text('file_path'), // Path to markdown file (relative to workspace)
    notebookId: text('notebook_id').references(() => notebooks.id, { onDelete: 'set null' }),
    workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).default(false),
    isPinned: integer('is_pinned', { mode: 'boolean' }).default(false),
    isArchived: integer('is_archived', { mode: 'boolean' }).default(false),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('idx_notes_workspace_id').on(table.workspaceId),
    index('idx_notes_notebook_id').on(table.notebookId),
    index('idx_notes_file_path').on(table.filePath),
    index('idx_notes_flags').on(
      table.isFavorite,
      table.isPinned,
      table.isArchived,
      table.isDeleted,
    ),
    index('idx_notes_updated_at').on(table.updatedAt),
    index('idx_notes_created_at').on(table.createdAt),
    index('idx_notes_deleted').on(table.isDeleted),
  ],
);

// Note Chunks table — chunk-level retrieval index.
// One row per markdown chunk of a note. Embedding is stored as a packed
// Float32Array BLOB (same convention as notes.embedding). Heading path is
// JSON-encoded string array. Content hash lets the indexer skip chunks
// whose text hasn't changed.
export const noteChunks = sqliteTable(
  'note_chunks',
  {
    id: text('id').primaryKey(),
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    headingPath: text('heading_path').notNull().default('[]'),
    text: text('text').notNull(),
    contentHash: text('content_hash').notNull(),
    tokenCount: integer('token_count').notNull().default(0),
    embedding: blob('embedding'), // F32_BLOB(384)
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('idx_note_chunks_note_id').on(table.noteId),
    index('idx_note_chunks_workspace_id').on(table.workspaceId),
    index('idx_note_chunks_content_hash').on(table.contentHash),
  ],
);

// Per-note index status — bookkeeping for what's been indexed and when.
// Distinct from the chunk rows so we can show "5/96 notes pending" without
// counting chunks, and so a failed index leaves a useful error trail.
export const noteIndexRecords = sqliteTable(
  'note_index_records',
  {
    noteId: text('note_id')
      .primaryKey()
      .references(() => notes.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    contentHash: text('content_hash').notNull(),
    chunkCount: integer('chunk_count').notNull().default(0),
    indexedAt: integer('indexed_at', { mode: 'timestamp' }),
    model: text('model'),
    dimensions: integer('dimensions'),
    status: text('status', { enum: ['pending', 'indexed', 'failed'] })
      .notNull()
      .default('pending'),
    error: text('error'),
  },
  (table) => [
    index('idx_note_index_records_workspace_id').on(table.workspaceId),
    index('idx_note_index_records_status').on(table.status),
  ],
);

// Tags table
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').default('#6b7280'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Note Tags junction table
export const noteTags = sqliteTable(
  'note_tags',
  {
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('idx_note_tags_note_id').on(table.noteId),
    index('idx_note_tags_tag_id').on(table.tagId),
    index('idx_note_tags_composite').on(table.tagId, table.noteId),
  ],
);

// Note Links table
export const noteLinks = sqliteTable('note_links', {
  sourceNoteId: text('source_note_id')
    .notNull()
    .references(() => notes.id, { onDelete: 'cascade' }),
  targetNoteId: text('target_note_id')
    .notNull()
    .references(() => notes.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Attachments table
export const attachments = sqliteTable(
  'attachments',
  {
    id: text('id').primaryKey(),
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    path: text('path').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('idx_attachments_note_id').on(table.noteId)],
);

// Note Versions table
export const noteVersions = sqliteTable('note_versions', {
  id: text('id').primaryKey(),
  noteId: text('note_id')
    .notNull()
    .references(() => notes.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  versionNumber: integer('version_number').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Topics table - for organizing notes by topic (predefined + auto-discovered)
export const topics = sqliteTable(
  'topics',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    description: text('description'),
    color: text('color').default('#6366f1'),
    isPredefined: integer('is_predefined', { mode: 'boolean' }).default(false),
    centroid: blob('centroid'), // F32_BLOB(384) - average embedding of topic's notes
    noteCount: integer('note_count').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('idx_topics_name').on(table.name),
    index('idx_topics_is_predefined').on(table.isPredefined),
  ],
);

// Note-Topic junction table (many-to-many relationship)
export const noteTopics = sqliteTable(
  'note_topics',
  {
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    topicId: text('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    confidence: real('confidence').default(1), // Classification confidence score
    isManual: integer('is_manual', { mode: 'boolean' }).default(false), // User-assigned vs auto-classified
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.noteId, table.topicId] }),
    index('idx_note_topics_note_id').on(table.noteId),
    index('idx_note_topics_topic_id').on(table.topicId),
  ],
);

// Settings table - key-value store for app settings
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Meeting recordings table - persistent transcripts + summaries for
// captured meetings. Audio itself is ephemeral and lives in
// <workspace>/.stone/recordings/ until the pipeline cleans it up; only
// the relative path is stored here so we can purge orphans on app start.
export const meetingRecordings = sqliteTable(
  'meeting_recordings',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    status: text('status').notNull().default('recording'),
    audioPath: text('audio_path'),
    durationMs: integer('duration_ms').notNull().default(0),
    transcriptText: text('transcript_text'),
    transcriptSegments: text('transcript_segments').notNull().default('[]'),
    summary: text('summary'),
    promptUsed: text('prompt_used'),
    journalDate: text('journal_date'),
    error: text('error'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('idx_meeting_recordings_workspace_id').on(table.workspaceId),
    index('idx_meeting_recordings_status').on(table.status),
    index('idx_meeting_recordings_created_at').on(table.createdAt),
  ],
);

// Durable background jobs — a libSQL-backed work queue so background tasks
// (e.g. retrying a failed transcription chunk, deferred re-indexing) survive
// an app restart. The JobRunner worker claims due rows, runs the registered
// handler, and reschedules with backoff or marks the row `dead` once attempts
// are exhausted. Terminal rows are pruned on a retention sweep so the table
// never grows unbounded on a user's machine.
export const jobs = sqliteTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    // Handler key, e.g. 'transcription.retry_chunk'. Maps to a registered handler.
    type: text('type').notNull(),
    // JSON-encoded handler payload (opaque to the queue).
    payload: text('payload').notNull().default('{}'),
    // pending → running → done | dead. `dead` is terminal (attempts exhausted).
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    // Earliest time this job may run — bumped on each retry for backoff.
    runAfter: integer('run_after', { mode: 'timestamp' }).notNull(),
    // When a runner claimed the row; used to detect jobs orphaned by a crash.
    claimedAt: integer('claimed_at', { mode: 'timestamp' }),
    lastError: text('last_error'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    // Hot path: claim due pending jobs ordered by run_after.
    index('idx_jobs_due').on(table.status, table.runAfter),
    index('idx_jobs_status').on(table.status),
    index('idx_jobs_type').on(table.type),
  ],
);
