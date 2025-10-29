# Stone - IPC API Reference

## Overview
This document defines all IPC channels and their request/response schemas for communication between Renderer and Main processes.

## Communication Pattern

### Request-Response Model
```typescript
// Renderer sends
ipcRenderer.invoke('channel:action', payload) -> Promise<response>

// Main receives and responds
ipcMain.handle('channel:action', (event, payload) => { ... return response })
```

### Event Model (One-way)
```typescript
// Renderer listens
ipcRenderer.on('channel:event', (event, data) => { ... })

// Main broadcasts
mainWindow.webContents.send('channel:event', data)
```

---

## Note Operations (notes:*)

### notes:create
Create a new note in a notebook.

**Request:**
```typescript
{
  title: string;              // Note title
  content?: string;           // Initial markdown content
  notebook_id?: string;       // Parent notebook ID
  tags?: string[];           // Tag IDs to assign
}
```

**Response:**
```typescript
{
  id: string;
  title: string;
  content: string;
  notebook_id: string | null;
  is_favorite: boolean;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: number;
  updated_at: number;
  tags: Array<{ id: string; name: string }>;
}
```

**Events Emitted:**
- `notes:created` - Broadcast to all windows

### notes:update
Update an existing note's content or metadata.

**Request:**
```typescript
{
  id: string;                 // Note ID
  title?: string;
  content?: string;          // Creates version snapshot
  notebook_id?: string;      // Move to different notebook
  tags?: string[];          // Replace all tags
}
```

**Response:**
```typescript
{
  id: string;
  title: string;
  content: string;
  notebook_id: string | null;
  is_favorite: boolean;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: number;
  updated_at: number;
  version_number: number;    // Current version after update
}
```

**Events Emitted:**
- `notes:updated` - Broadcast with note ID

**Behavior:**
- Content changes trigger automatic version creation
- Metadata changes don't create versions
- Updates are debounced in renderer (2s)

### notes:delete
Soft delete (move to trash) a note.

**Request:**
```typescript
{
  id: string;                 // Note ID
  permanent?: boolean;       // If true, hard delete
}
```

**Response:**
```typescript
{
  success: boolean;
  id: string;
  message?: string;
}
```

**Events Emitted:**
- `notes:deleted` - Broadcast with note ID

**Behavior:**
- Default: soft delete with recovery window
- Permanent flag: permanently deletes note

### notes:get
Retrieve a single note by ID.

**Request:**
```typescript
{
  id: string;                 // Note ID
  include_versions?: boolean; // Include version history
  include_backlinks?: boolean; // Include backlink notes
}
```

**Response:**
```typescript
{
  id: string;
  title: string;
  content: string;
  notebook_id: string | null;
  is_favorite: boolean;
  is_pinned: boolean;
  is_archived: boolean;
  is_deleted: boolean;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  tags: Array<{ id: string; name: string; color: string }>;
  versions?: Array<{
    id: string;
    version_number: number;
    created_at: number;
  }>;
  backlinks?: Array<{
    id: string;
    title: string;
    notebook_id: string;
  }>;
  attachments: Array<{
    id: string;
    filename: string;
    size: number;
    mimetype: string;
  }>;
}
```

### notes:getAll
Retrieve all notes with optional filtering.

**Request:**
```typescript
{
  notebook_id?: string;      // Filter by notebook
  tag_id?: string;          // Filter by tag
  is_favorite?: boolean;    // Show only favorites
  is_pinned?: boolean;      // Show only pinned
  is_archived?: boolean;    // Include archived notes
  is_deleted?: boolean;     // Show deleted notes
  sort?: 'updated' | 'created' | 'title'; // Sort field
  order?: 'asc' | 'desc';   // Sort order
  limit?: number;           // Pagination limit
  offset?: number;          // Pagination offset
}
```

**Response:**
```typescript
{
  items: Array<{
    id: string;
    title: string;
    content_preview: string;  // First 200 chars
    notebook_id: string | null;
    is_favorite: boolean;
    is_pinned: boolean;
    created_at: number;
    updated_at: number;
    tag_count: number;
    attachment_count: number;
  }>;
  total: number;             // Total matching notes
  hasMore: boolean;          // More items available
}
```

### notes:favorite
Toggle favorite status.

**Request:**
```typescript
{
  id: string;
  is_favorite: boolean;
}
```

**Response:**
```typescript
{
  id: string;
  is_favorite: boolean;
}
```

### notes:pin
Toggle pin status.

**Request:**
```typescript
{
  id: string;
  is_pinned: boolean;
}
```

**Response:**
```typescript
{
  id: string;
  is_pinned: boolean;
}
```

### notes:archive
Toggle archive status.

**Request:**
```typescript
{
  id: string;
  is_archived: boolean;
}
```

**Response:**
```typescript
{
  id: string;
  is_archived: boolean;
}
```

### notes:getVersions
Retrieve version history for a note.

**Request:**
```typescript
{
  note_id: string;
  limit?: number;
  offset?: number;
}
```

**Response:**
```typescript
{
  versions: Array<{
    id: string;
    version_number: number;
    title: string;
    created_at: number;
    content_preview: string;
  }>;
  total: number;
}
```

### notes:restoreVersion
Restore note to a previous version.

**Request:**
```typescript
{
  note_id: string;
  version_id: string;
}
```

**Response:**
```typescript
{
  id: string;
  title: string;
  content: string;
  version_number: number;
  message: string;
}
```

**Events Emitted:**
- `notes:versionRestored`

### notes:getBacklinks
Get all notes that link to this note.

**Request:**
```typescript
{
  note_id: string;
}
```

**Response:**
```typescript
{
  backlinks: Array<{
    id: string;
    title: string;
    notebook_id: string;
    created_at: number;
  }>;
}
```

---

## Notebook Operations (notebooks:*)

### notebooks:create
Create a new notebook or folder.

**Request:**
```typescript
{
  name: string;              // Notebook name
  parent_id?: string;       // Parent notebook ID
  icon?: string;            // Emoji icon
  color?: string;           // Hex color
  position?: number;        // Sort order
}
```

**Response:**
```typescript
{
  id: string;
  name: string;
  parent_id: string | null;
  icon: string;
  color: string;
  position: number;
  created_at: number;
  updated_at: number;
  note_count?: number;
}
```

**Events Emitted:**
- `notebooks:created`

### notebooks:update
Update notebook properties.

**Request:**
```typescript
{
  id: string;
  name?: string;
  icon?: string;
  color?: string;
  position?: number;
}
```

**Response:**
```typescript
{
  id: string;
  name: string;
  icon: string;
  color: string;
  position: number;
  updated_at: number;
}
```

### notebooks:delete
Delete a notebook (cascades to notes if configured).

**Request:**
```typescript
{
  id: string;
  delete_notes?: boolean;   // If false, orphan notes
}
```

**Response:**
```typescript
{
  success: boolean;
  deleted_notebook_count: number;
  orphaned_note_count: number;
}
```

### notebooks:getAll
Get all notebooks with optional hierarchy.

**Request:**
```typescript
{
  include_counts?: boolean;  // Include note counts
  flat?: boolean;           // Flat list instead of tree
}
```

**Response (Hierarchical):**
```typescript
{
  notebooks: Array<{
    id: string;
    name: string;
    icon: string;
    color: string;
    position: number;
    note_count: number;
    children: Array<Notebook>; // Recursive
  }>;
}
```

### notebooks:move
Move notebook to a different parent.

**Request:**
```typescript
{
  id: string;
  parent_id?: string;       // New parent (null = root)
  position?: number;        // New position
}
```

**Response:**
```typescript
{
  id: string;
  parent_id: string | null;
  position: number;
}
```

---

## Tag Operations (tags:*)

### tags:create
Create a new tag.

**Request:**
```typescript
{
  name: string;             // Unique tag name
  color?: string;           // Hex color
}
```

**Response:**
```typescript
{
  id: string;
  name: string;
  color: string;
  created_at: number;
  note_count: number;
}
```

### tags:delete
Delete a tag (removes from all notes).

**Request:**
```typescript
{
  id: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  affected_notes: number;
}
```

### tags:getAll
Get all tags with statistics.

**Request:**
```typescript
{
  sort?: 'name' | 'count' | 'recent';
}
```

**Response:**
```typescript
{
  tags: Array<{
    id: string;
    name: string;
    color: string;
    note_count: number;
    created_at: number;
  }>;
}
```

### tags:addToNote
Add one or more tags to a note.

**Request:**
```typescript
{
  note_id: string;
  tag_ids: string[];
}
```

**Response:**
```typescript
{
  success: boolean;
  note_id: string;
  tags: Array<{ id: string; name: string }>;
}
```

### tags:removeFromNote
Remove a tag from a note.

**Request:**
```typescript
{
  note_id: string;
  tag_id: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  note_id: string;
}
```

---

## Search Operations (search:*)

### search:fullText
Full-text search using FTS5.

**Request:**
```typescript
{
  query: string;             // Search query
  notebook_id?: string;     // Filter by notebook
  tag_ids?: string[];       // Filter by tags
  limit?: number;           // Result limit (default 50)
  offset?: number;          // Pagination offset
}
```

**Response:**
```typescript
{
  results: Array<{
    id: string;
    title: string;
    content: string;
    notebook_id: string;
    relevance: number;       // 0-1 score
    title_highlight?: string; // HTML with <mark> tags
    content_highlight?: string;
    created_at: number;
  }>;
  total: number;
  query_time_ms: number;
}
```

### search:semantic
Semantic search using vector embeddings.

**Request:**
```typescript
{
  query: string;             // Natural language query
  threshold?: number;        // Similarity threshold (0-1)
  limit?: number;           // Result limit (default 20)
  notebook_id?: string;     // Filter by notebook
}
```

**Response:**
```typescript
{
  results: Array<{
    id: string;
    title: string;
    content_preview: string;
    notebook_id: string;
    similarity: number;       // 0-1 similarity score
    created_at: number;
  }>;
  total: number;
  query_time_ms: number;
}
```

### search:hybrid
Combined FTS and semantic search.

**Request:**
```typescript
{
  query: string;
  weights?: {
    fts: number;            // FTS weight (default 0.4)
    semantic: number;       // Semantic weight (default 0.6)
  };
  limit?: number;
  notebook_id?: string;
  tag_ids?: string[];
}
```

**Response:**
```typescript
{
  results: Array<{
    id: string;
    title: string;
    content_preview: string;
    notebook_id: string;
    score: number;           // Blended score
    search_type: 'fts' | 'semantic' | 'both';
    created_at: number;
  }>;
  total: number;
  query_time_ms: number;
}
```

### search:byTag
Find all notes with specific tags.

**Request:**
```typescript
{
  tag_ids: string[];
  match_all?: boolean;      // AND vs OR logic
  limit?: number;
  offset?: number;
}
```

**Response:**
```typescript
{
  notes: Array<Note>;
  total: number;
}
```

### search:byDateRange
Find notes created within a date range.

**Request:**
```typescript
{
  start_date: number;       // Unix timestamp
  end_date: number;
  field?: 'created' | 'updated';
  limit?: number;
}
```

**Response:**
```typescript
{
  notes: Array<Note>;
  total: number;
}
```

---

## Attachment Operations (attachments:*)

### attachments:add
Add an attachment to a note.

**Request:**
```typescript
{
  note_id: string;
  file_path: string;        // Absolute path to file
  filename?: string;        // Display name
}
```

**Response:**
```typescript
{
  id: string;
  note_id: string;
  filename: string;
  filepath: string;         // Relative path in storage
  size: number;
  mimetype: string;
  created_at: number;
}
```

**Events Emitted:**
- `attachments:added`

### attachments:delete
Remove an attachment from a note.

**Request:**
```typescript
{
  id: string;
  note_id: string;
}
```

**Response:**
```typescript
{
  success: boolean;
}
```

### attachments:getAll
Get all attachments for a note.

**Request:**
```typescript
{
  note_id: string;
}
```

**Response:**
```typescript
{
  attachments: Array<{
    id: string;
    filename: string;
    filepath: string;
    size: number;
    mimetype: string;
    created_at: number;
  }>;
}
```

---

## Database Management (db:*)

### db:getStatus
Get current database status and statistics.

**Request:**
```typescript
{}
```

**Response:**
```typescript
{
  version: number;           // Current schema version
  is_migrating: boolean;
  note_count: number;
  notebook_count: number;
  tag_count: number;
  attachment_count: number;
  database_size: number;     // In bytes
  vector_size: number;       // Vector DB size
  last_backup?: number;      // Unix timestamp
  last_defrag?: number;
  integrity_ok: boolean;
  error?: string;
}
```

### db:runMigrations
Execute pending migrations.

**Request:**
```typescript
{
  auto_backup?: boolean;     // Create backup first
}
```

**Response:**
```typescript
{
  success: boolean;
  migrations_run: number;
  new_version: number;
  error?: string;
}
```

**Events Emitted:**
- `db:migrationProgress` - {current: number, total: number, name: string}
- `db:migrationComplete` - {version: number, success: boolean}

### db:backup
Create a database backup.

**Request:**
```typescript
{
  label?: string;            // User-friendly label
  include_attachments?: boolean; // Include files
}
```

**Response:**
```typescript
{
  success: boolean;
  backup_id: string;
  path: string;
  size: number;
  timestamp: number;
}
```

**Events Emitted:**
- `db:backupProgress` - {progress: number, total: number}
- `db:backupComplete`

### db:restore
Restore from a backup.

**Request:**
```typescript
{
  backup_id: string;
  verify_first?: boolean;   // Integrity check before restore
}
```

**Response:**
```typescript
{
  success: boolean;
  restored_timestamp: number;
  notes_restored: number;
  error?: string;
}
```

**Events Emitted:**
- `db:restoreProgress`
- `db:restoreComplete`

### db:export
Export notes as files.

**Request:**
```typescript
{
  format: 'markdown' | 'json' | 'html';
  notebook_id?: string;     // Export specific notebook
  include_attachments?: boolean;
  output_path?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  output_path: string;
  note_count: number;
  file_size: number;
}
```

### db:import
Import notes from files.

**Request:**
```typescript
{
  format: 'markdown' | 'json' | 'evernote';
  input_path: string;
  target_notebook_id?: string;
  merge?: boolean;           // Merge with existing
}
```

**Response:**
```typescript
{
  success: boolean;
  imported_count: number;
  skipped_count: number;
  errors?: Array<{
    file: string;
    error: string;
  }>;
}
```

### db:vacuum
Optimize database (VACUUM + ANALYZE).

**Request:**
```typescript
{}
```

**Response:**
```typescript
{
  success: boolean;
  size_before: number;
  size_after: number;
  freed_bytes: number;
}
```

**Events Emitted:**
- `db:vacuumProgress`
- `db:vacuumComplete`

### db:checkIntegrity
Run integrity checks on database.

**Request:**
```typescript
{
  detailed?: boolean;        // Full integrity check
}
```

**Response:**
```typescript
{
  ok: boolean;
  foreign_keys_ok: boolean;
  errors: string[];
  warnings: string[];
}
```

### db:getMigrationHistory
Get list of applied migrations.

**Request:**
```typescript
{}
```

**Response:**
```typescript
{
  migrations: Array<{
    version: number;
    name: string;
    applied_at: number;
  }>;
}
```

---

## Settings Operations (settings:*)

### settings:get
Get a setting value.

**Request:**
```typescript
{
  key: string;
}
```

**Response:**
```typescript
{
  key: string;
  value: any;
  updated_at: number;
}
```

### settings:set
Set a setting value.

**Request:**
```typescript
{
  key: string;
  value: any;
}
```

**Response:**
```typescript
{
  key: string;
  value: any;
  updated_at: number;
}
```

**Events Emitted:**
- `settings:changed` - {key: string, value: any}

### settings:getAll
Get all settings.

**Request:**
```typescript
{}
```

**Response:**
```typescript
{
  settings: Record<string, any>;
}
```

---

## Event Broadcasting (Publish-Subscribe)

### Window Events
Events sent by main process to all renderer windows:

```typescript
ipcRenderer.on('channel:event', (event, data) => {})
```

**Available Events:**
- `notes:created` - {note: Note}
- `notes:updated` - {note: Note}
- `notes:deleted` - {id: string}
- `notebooks:created` - {notebook: Notebook}
- `notebooks:updated` - {notebook: Notebook}
- `notebooks:deleted` - {id: string}
- `tags:created` - {tag: Tag}
- `tags:deleted` - {id: string}
- `tags:updated` - {tag: Tag}
- `attachments:added` - {attachment: Attachment}
- `attachments:deleted` - {id: string}
- `db:migrationProgress` - {current: number, total: number}
- `db:migrationComplete` - {version: number}
- `db:backupProgress` - {progress: number}
- `db:backupComplete` - {backup_id: string}
- `settings:changed` - {key: string, value: any}

---

## Error Handling

All IPC calls may throw errors with standardized error objects:

```typescript
{
  code: string;              // Error code
  message: string;           // Human-readable message
  details?: any;            // Additional context
  timestamp: number;        // When error occurred
}
```

**Common Error Codes:**
- `INVALID_INPUT` - Validation failed
- `NOT_FOUND` - Resource doesn't exist
- `PERMISSION_DENIED` - Operation not allowed
- `DATABASE_ERROR` - DB operation failed
- `FILE_ERROR` - File operation failed
- `MIGRATION_ERROR` - Migration failed
- `VECTOR_ERROR` - Embedding generation failed
- `INTERNAL_ERROR` - Unexpected error

---

**API Version:** 1.0
**Last Updated:** 2025-10-29
**Status:** Finalized - Ready for Implementation
