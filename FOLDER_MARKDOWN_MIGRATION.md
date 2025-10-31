# Stone - Folder-Based Markdown Editor Migration

## Overview

Transforming Stone from a database-only note app into a multi-workspace markdown editor that stores notes as `.md` files in user-selected folders.

## Architecture Changes

### Current State
- SQLite database stores everything (notes content, notebooks, tags, attachments, versions)
- Notes stored as HTML content in database
- TipTap editor for rich text editing
- No file system integration for markdown files

### Target State
- **Multi-workspace**: Users can add multiple folders as workspaces
- **Folder structure**: Folders/subfolders map to notebooks
- **Markdown files**: Note content stored in `.md` files
- **Database metadata**: Tags, favorites, workspace configs kept in database
- **Auto-save**: Debounced save with manual override (Cmd+S)
- **File watching**: Detect external changes and reload

---

## Progress Tracker

### ✅ Phase 1: Core Infrastructure (COMPLETED)

#### 1.1 Workspace Management System
- [x] Add workspace table to database schema
- [x] Create WorkspaceRepository for CRUD operations
- [x] Add workspace types to shared types
- [x] Generate database migration

#### 1.2 File System Service
- [x] Create FileSystemService with:
  - Read/write markdown files
  - Scan folders for .md files
  - Get folder structure (for notebook tree)
  - File validation and stats
  - YAML frontmatter support (gray-matter)
- [x] Create MarkdownService with:
  - HTML → Markdown conversion (turndown)
  - Markdown → HTML conversion (marked)
  - Filename sanitization
  - Title extraction from markdown

#### 1.3 Database Schema Changes
- [x] Add `workspaces` table (id, name, folderPath, isActive, timestamps)
- [x] Update `notebooks` table (add workspaceId, folderPath columns)
- [x] Update `notes` table (add filePath, workspaceId, make content nullable)
- [x] Generate migration: `migrations/0001_wide_power_pack.sql`

### ✅ Phase 2: IPC Infrastructure (COMPLETED)

#### 2.1 IPC Channels & Events
- [x] Add WORKSPACE_CHANNELS constants
- [x] Add workspace events (created, updated, deleted, switched, scanned)
- [x] Add file events (changed, created, deleted)

#### 2.2 Workspace Handlers
- [x] Create workspaceHandlers.ts with:
  - `workspaces:selectFolder` - Electron folder picker dialog
  - `workspaces:validatePath` - Validate folder permissions
  - `workspaces:create` - Add new workspace
  - `workspaces:getAll` - List all workspaces
  - `workspaces:getActive` - Get active workspace
  - `workspaces:setActive` - Switch workspace
  - `workspaces:update` - Update workspace name
  - `workspaces:delete` - Remove workspace
  - `workspaces:scan` - Scan folder for markdown files
- [x] Register workspace handlers in IPC index

### ✅ Phase 3: Data Layer Integration (COMPLETED)

#### 3.1 Update NoteRepository
- [x] **Modify `create()`**:
  - Create .md file in workspace folder
  - Store file path in database
  - Keep metadata (favorite, pinned, etc.) in DB
  - Return note with content from file

- [x] **Modify `update()`**:
  - Write content to .md file
  - Update database metadata
  - Handle file renames when title changes

- [x] **Modify `findById()`**:
  - Read content from file system if filePath exists
  - Merge with database metadata
  - Fall back to DB content for legacy notes

- [x] **Modify `delete()`**:
  - Remove .md file from file system
  - Delete database entry

- [x] **Add `getContentFromFile()`**: Helper to read markdown file
- [x] **Add `saveContentToFile()`**: Helper to write markdown file
- [x] **Add `syncWithFileSystem()`**: Reconcile DB entries with actual files

#### 3.2 Update NotebookRepository
- [ ] Map notebooks to folder structure
- [ ] Sync folder changes with notebook hierarchy
- [ ] Handle folder creation/deletion

#### 3.3 Create SyncService
- [ ] Scan workspace folder on load
- [ ] Match markdown files to database entries
- [ ] Handle missing files (deleted externally)
- [ ] Handle new files (created externally)
- [ ] Handle renamed files
- [ ] Conflict resolution (file modified while app open)

### 📋 Phase 4: File Watching (PENDING)

#### 4.1 File Watcher Service
- [ ] Create FileWatcherService using chokidar
- [ ] Watch active workspace folder for changes
- [ ] Handle file events:
  - `add` - New file created
  - `change` - File content modified
  - `unlink` - File deleted
  - `unlinkDir` - Folder deleted
  - `addDir` - New folder created
- [ ] Debounce events (avoid rapid fire)
- [ ] Broadcast to renderer process
- [ ] Start/stop watchers on workspace switch

#### 4.2 Conflict Resolution
- [ ] Detect when file changed externally while editor is open
- [ ] Show notification to user
- [ ] Provide options: Keep local / Use external / Show diff

### 📋 Phase 5: Editor & UI (PENDING)

#### 5.1 Markdown Editor Integration
- [ ] Update TipTap to use markdown format:
  - Add markdown serializer/deserializer
  - Or use `@tiptap/extension-markdown`
- [ ] Implement auto-save:
  - Debounce: 500ms after typing stops
  - Save to markdown file via IPC
- [ ] Add manual save:
  - Cmd+S / Ctrl+S handler
  - Call save immediately (no debounce)
- [ ] Add save status indicator:
  - Show "Saving..." / "Saved" / "Unsaved changes"
  - Visual feedback in header

#### 5.2 UI Components - Workspace Management
- [ ] **Workspace Switcher**:
  - Dropdown or sidebar widget
  - Show all workspaces
  - Highlight active workspace
  - Switch on click

- [ ] **"Add Workspace" Flow**:
  - Button in sidebar or settings
  - Open folder picker dialog
  - Show folder path preview
  - Prompt for workspace name
  - Scan folder and show file count
  - Confirm and create

- [ ] **Workspace Settings Panel**:
  - List all workspaces
  - Edit workspace name
  - Remove workspace (with confirmation)
  - Show folder path
  - Set default workspace

#### 5.3 UI Components - File System Integration
- [ ] **External Change Notifications**:
  - Toast/banner when file changed externally
  - "Reload" button to refresh from file
  - Conflict resolution dialog if needed

- [ ] **Notebook Tree Updates**:
  - Dynamically populate from folder structure
  - Show folders as notebooks
  - Show .md files as notes
  - Distinguish folders vs files with icons
  - Support creating new folders
  - Support creating new notes (new .md file)

#### 5.4 Note Creation/Editing
- [ ] Update "New Note" button:
  - Create .md file in selected notebook folder
  - Generate filename from title
  - Handle duplicates (append number)
- [ ] Update note title editing:
  - Rename .md file when title changes
  - Update database filePath
- [ ] Add file path indicator:
  - Show relative path in note header (optional)

### 📋 Phase 6: Settings & Configuration (PENDING)

#### 6.1 Workspace Settings
- [ ] Settings modal section for workspaces
- [ ] Workspace list with actions (edit, remove)
- [ ] Default workspace selection
- [ ] Auto-save interval configuration
- [ ] File naming preferences:
  - Sanitization rules
  - Use title vs timestamp
  - Subfolder organization

#### 6.2 File Handling Settings
- [ ] Auto-save toggle (on/off)
- [ ] Auto-save delay (milliseconds)
- [ ] File watcher toggle
- [ ] Hidden file handling (show/ignore)
- [ ] Conflict resolution preference (ask/auto-use-local/auto-use-external)

### 📋 Phase 7: Migration & Compatibility (PENDING)

#### 7.1 Data Migration Tool
- [ ] Export existing database notes to markdown files
- [ ] Create migration wizard UI
- [ ] Prompt user to select export folder
- [ ] Convert HTML content to markdown
- [ ] Preserve note metadata in YAML frontmatter
- [ ] Create folder structure matching notebooks
- [ ] Migration progress indicator

#### 7.2 Backward Compatibility
- [ ] Support hybrid mode:
  - Show both database notes and workspace notes
  - Distinguish visually (icon or label)
- [ ] Allow converting individual notes to markdown
- [ ] Keep existing database for legacy notes (optional)

---

## Technical Implementation Details

### Dependencies Added
```json
{
  "dependencies": {
    "chokidar": "^4.0.3",     // File watching
    "gray-matter": "^4.0.3",   // YAML frontmatter parsing
    "turndown": "^7.2.2",      // HTML → Markdown
    "marked": "^16.4.1"        // Markdown → HTML
  },
  "devDependencies": {
    "@types/turndown": "^5.0.6"
  }
}
```

### File Structure
```
src/main/
├── repositories/
│   ├── WorkspaceRepository.ts          ✅ Created
│   └── index.ts                        ✅ Updated
├── services/
│   ├── MarkdownService.ts              ✅ Created
│   ├── FileSystemService.ts            ✅ Created
│   └── FileWatcherService.ts           ⏳ TODO
├── ipc/
│   └── handlers/
│       └── workspaceHandlers.ts        ✅ Created
└── database/
    └── schema.ts                       ✅ Updated

src/shared/
├── types/index.ts                      ✅ Updated (added Workspace)
└── constants/ipcChannels.ts            ✅ Updated (added WORKSPACE_CHANNELS)

migrations/
└── 0001_wide_power_pack.sql            ✅ Generated
```

### Database Schema

#### Workspaces Table
```sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  folder_path TEXT NOT NULL UNIQUE,
  is_active INTEGER DEFAULT false,
  created_at INTEGER NOT NULL,
  last_accessed_at INTEGER NOT NULL
);
```

#### Notes Table (Updated)
```sql
ALTER TABLE notes ADD file_path TEXT;
ALTER TABLE notes ADD workspace_id TEXT REFERENCES workspaces(id);
-- content column made nullable
```

#### Notebooks Table (Updated)
```sql
ALTER TABLE notebooks ADD workspace_id TEXT REFERENCES workspaces(id);
ALTER TABLE notebooks ADD folder_path TEXT;
```

### Markdown File Format

#### Basic Markdown File
```markdown
# Note Title

This is the content of the note in **markdown** format.

- List item 1
- List item 2
```

#### With YAML Frontmatter (Optional)
```markdown
---
tags: [work, important]
favorite: true
pinned: false
created: 2025-01-15T10:30:00Z
modified: 2025-01-15T15:45:00Z
---

# Note Title

Note content goes here...
```

### File Naming Convention
- Use sanitized note title as filename
- Replace invalid characters: `/ \ ? % * : | " < >` → `-`
- Limit to 200 characters
- Add `.md` extension
- Handle duplicates: `Note.md`, `Note 1.md`, `Note 2.md`

### Folder Structure Example
```
/Users/username/Documents/MyNotes/        # Workspace root
├── Work/                                  # Notebook (folder)
│   ├── Meeting Notes.md
│   ├── Project Ideas.md
│   └── Client/                            # Sub-notebook
│       └── Requirements.md
├── Personal/                              # Notebook
│   ├── Journal.md
│   └── Todo List.md
└── Quick Notes.md                         # Root-level note
```

---

## Testing Checklist

### Workspace Management
- [ ] Add new workspace via folder picker
- [ ] List all workspaces
- [ ] Switch between workspaces
- [ ] Rename workspace
- [ ] Delete workspace
- [ ] Scan workspace folder for existing markdown files

### Note Operations (File-Based)
- [ ] Create new note → Creates .md file
- [ ] Edit note → Updates .md file
- [ ] Rename note → Renames .md file
- [ ] Delete note → Removes .md file
- [ ] View note → Reads from .md file

### File System Integration
- [ ] Detect external file creation
- [ ] Detect external file modification
- [ ] Detect external file deletion
- [ ] Handle file rename externally
- [ ] Handle folder rename externally
- [ ] Conflict resolution works

### Auto-Save
- [ ] Auto-save triggers after typing stops
- [ ] Manual save (Cmd+S) works immediately
- [ ] Save indicator shows correct status
- [ ] No save conflicts with auto-save

### Notebook Tree
- [ ] Shows folder structure from workspace
- [ ] Create new folder → Creates directory
- [ ] Delete folder → Removes directory
- [ ] Drag-drop notes between folders
- [ ] Nested folders render correctly

### Data Migration
- [ ] Export existing notes to markdown
- [ ] Preserve note metadata
- [ ] Maintain folder hierarchy
- [ ] No data loss during migration

### Edge Cases
- [ ] Handle missing workspace folder
- [ ] Handle permission errors
- [ ] Handle file system errors (disk full, etc.)
- [ ] Handle invalid markdown files
- [ ] Handle very long filenames
- [ ] Handle special characters in filenames
- [ ] Handle concurrent edits (file watcher conflict)

---

## Known Issues & Considerations

### Performance
- Large folders (1000+ markdown files) may slow down scanning
- Consider implementing pagination or lazy loading
- File watcher may trigger many events for bulk operations

### Data Integrity
- Need robust error handling for file system operations
- Backup/restore functionality for workspace data
- Handle corrupted markdown files gracefully

### Cross-Platform
- Path separators differ (Windows vs Unix)
- Use `path.join()` consistently
- Test on Windows, macOS, Linux

### User Experience
- Clear messaging for external file changes
- Graceful fallback if workspace folder is unavailable
- Option to "detach" workspace without deleting files

---

## Next Steps (Priority Order)

1. **Update NoteRepository** - Critical for file system integration
2. **Create FileWatcherService** - Essential for external change detection
3. **Update TipTap Editor** - Enable markdown editing
4. **Implement Auto-Save** - Core UX feature
5. **Build Workspace UI** - Allow users to manage workspaces
6. **Update Notebook Tree** - Show folder structure
7. **Add Settings Panel** - Configure workspace behavior
8. **Create Migration Tool** - Help users transition existing notes

---

## References

- **Chokidar**: https://github.com/paulmillr/chokidar
- **Gray Matter**: https://github.com/jonschlinkert/gray-matter
- **Turndown**: https://github.com/mixmark-io/turndown
- **Marked**: https://marked.js.org/
- **TipTap Markdown**: https://tiptap.dev/docs/editor/extensions/functionality/markdown
