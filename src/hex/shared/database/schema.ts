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
export const notebooks = sqliteTable('notebooks', {
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
}, (table) => [
  index('idx_notebooks_workspace_id').on(table.workspaceId),
  index('idx_notebooks_folder_path').on(table.folderPath),
  index('idx_notebooks_parent_id').on(table.parentId),
]);

// Notes table
export const notes = sqliteTable('notes', {
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
  embedding: blob('embedding'), // F32_BLOB(384) - 384-dim float vector for semantic search
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_notes_workspace_id').on(table.workspaceId),
  index('idx_notes_notebook_id').on(table.notebookId),
  index('idx_notes_file_path').on(table.filePath),
  index('idx_notes_flags').on(table.isFavorite, table.isPinned, table.isArchived, table.isDeleted),
  index('idx_notes_updated_at').on(table.updatedAt),
  index('idx_notes_created_at').on(table.createdAt),
  index('idx_notes_deleted').on(table.isDeleted),
]);

// Tags table
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').default('#6b7280'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Note Tags junction table
export const noteTags = sqliteTable('note_tags', {
  noteId: text('note_id')
    .notNull()
    .references(() => notes.id, { onDelete: 'cascade' }),
  tagId: text('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_note_tags_note_id').on(table.noteId),
  index('idx_note_tags_tag_id').on(table.tagId),
  index('idx_note_tags_composite').on(table.tagId, table.noteId),
]);

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
export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(),
  noteId: text('note_id')
    .notNull()
    .references(() => notes.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  path: text('path').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_attachments_note_id').on(table.noteId),
]);

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
export const topics = sqliteTable('topics', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  color: text('color').default('#6366f1'),
  isPredefined: integer('is_predefined', { mode: 'boolean' }).default(false),
  centroid: blob('centroid'), // F32_BLOB(384) - average embedding of topic's notes
  noteCount: integer('note_count').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_topics_name').on(table.name),
  index('idx_topics_is_predefined').on(table.isPredefined),
]);

// Note-Topic junction table (many-to-many relationship)
export const noteTopics = sqliteTable('note_topics', {
  noteId: text('note_id')
    .notNull()
    .references(() => notes.id, { onDelete: 'cascade' }),
  topicId: text('topic_id')
    .notNull()
    .references(() => topics.id, { onDelete: 'cascade' }),
  confidence: real('confidence').default(1), // Classification confidence score
  isManual: integer('is_manual', { mode: 'boolean' }).default(false), // User-assigned vs auto-classified
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.noteId, table.topicId] }),
  index('idx_note_topics_note_id').on(table.noteId),
  index('idx_note_topics_topic_id').on(table.topicId),
]);
