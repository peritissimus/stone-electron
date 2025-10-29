# Stone - Implementation Guide

## Table of Contents
1. [Project Setup](#project-setup)
2. [Directory Structure](#directory-structure)
3. [Database Setup](#database-setup)
4. [Migration System](#migration-system)
5. [Repository Implementation](#repository-implementation)
6. [IPC Handler Setup](#ipc-handler-setup)
7. [React Component Structure](#react-component-structure)
8. [Development Workflow](#development-workflow)
9. [Testing Strategy](#testing-strategy)
10. [Deployment](#deployment)

---

## Project Setup

### Initial Dependencies

```bash
# Core Electron & Build
npm install electron vite @vitejs/plugin-react electron-builder electron-store

# Database
npm install better-sqlite3 vectra @xenova/transformers

# UI & Styling
npm install react react-dom react-query zustand
npm install tailwindcss postcss autoprefixer
npm install shadcn-ui lucide-react

# Rich Text Editing
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-image
npm install prismjs markdown-it

# Utilities
npm install nanoid zod date-fns

# Development
npm install -D typescript @types/node @types/react vite-plugin-electron
npm install -D tailwind-merge class-variance-authority
```

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@main/*": ["src/main/*"],
      "@renderer/*": ["src/renderer/*"],
      "@shared/*": ["src/shared/*"]
    }
  }
}
```

---

## Directory Structure

```
stone/
├── src/
│   ├── main/
│   │   ├── database/
│   │   │   ├── DatabaseManager.ts
│   │   │   ├── MigrationRunner.ts
│   │   │   ├── BackupManager.ts
│   │   │   └── index.ts
│   │   ├── repositories/
│   │   │   ├── BaseRepository.ts
│   │   │   ├── NoteRepository.ts
│   │   │   ├── NotebookRepository.ts
│   │   │   ├── TagRepository.ts
│   │   │   ├── AttachmentRepository.ts
│   │   │   ├── VersionRepository.ts
│   │   │   └── index.ts
│   │   ├── ipc/
│   │   │   ├── handlers/
│   │   │   │   ├── noteHandlers.ts
│   │   │   │   ├── notebookHandlers.ts
│   │   │   │   ├── tagHandlers.ts
│   │   │   │   ├── searchHandlers.ts
│   │   │   │   ├── attachmentHandlers.ts
│   │   │   │   ├── databaseHandlers.ts
│   │   │   │   └── settingsHandlers.ts
│   │   │   ├── channels.ts
│   │   │   └── index.ts
│   │   ├── services/
│   │   │   ├── SearchService.ts
│   │   │   ├── EmbeddingService.ts
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   ├── logger.ts
│   │   │   └── errors.ts
│   │   ├── preload.ts
│   │   └── index.ts
│   ├── renderer/
│   │   ├── pages/
│   │   │   ├── Editor.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── NotFound.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   ├── editor/
│   │   │   ├── search/
│   │   │   ├── notebooks/
│   │   │   ├── notes/
│   │   │   ├── tags/
│   │   │   └── common/
│   │   ├── stores/
│   │   │   ├── noteStore.ts
│   │   │   ├── notebookStore.ts
│   │   │   ├── tagStore.ts
│   │   │   ├── searchStore.ts
│   │   │   ├── uiStore.ts
│   │   │   └── appStore.ts
│   │   ├── hooks/
│   │   │   ├── useNotes.ts
│   │   │   ├── useSearch.ts
│   │   │   ├── useIpc.ts
│   │   │   └── useDebounce.ts
│   │   ├── utils/
│   │   │   ├── formatters.ts
│   │   │   ├── validators.ts
│   │   │   └── storage.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── shared/
│       ├── types/
│       │   ├── index.ts
│       │   ├── database.ts
│       │   ├── ipc.ts
│       │   └── models.ts
│       ├── constants/
│       │   ├── ipcChannels.ts
│       │   ├── defaults.ts
│       │   └── regex.ts
│       └── utils/
│           ├── id.ts
│           ├── validation.ts
│           └── formatting.ts
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_add_fts_index.sql
│   ├── 003_add_vector_metadata.sql
│   └── migration.template.sql
├── docs/
│   ├── HLD.md
│   ├── DATABASE_SCHEMA.md
│   ├── IPC_API.md
│   └── IMPLEMENTATION_GUIDE.md
├── public/
│   ├── electron.vite.config.ts
│   ├── electron.preload.ts
│   └── index.html
├── config/
│   ├── electron-builder.yml
│   ├── vite.config.ts
│   ├── vite.main.config.ts
│   └── vite.renderer.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## Database Setup

### DatabaseManager Implementation

The DatabaseManager is the core component that handles all database operations.

**Key Responsibilities:**
1. Initialize database connection on app start
2. Run pending migrations
3. Manage database lifecycle
4. Provide transaction support
5. Emit events for UI feedback
6. Handle backup/restore operations

**Initialization Flow:**
```typescript
class DatabaseManager {
  private db: Database;
  private migrationRunner: MigrationRunner;
  private backupManager: BackupManager;

  constructor(dataPath: string) {
    // 1. Open database
    this.db = new Database(dataPath);
    this.db.pragma('foreign_keys = ON');

    // 2. Initialize managers
    this.migrationRunner = new MigrationRunner(this.db);
    this.backupManager = new BackupManager(dataPath);

    // 3. Set up maintenance timers
    this.scheduleVacuum();
  }

  async initialize(): Promise<void> {
    // Check for pending migrations
    const pending = await this.migrationRunner.getPendingMigrations();

    if (pending.length > 0) {
      // Create backup before migration
      await this.backupManager.createBackup('pre-migration');

      // Run migrations
      for (const migration of pending) {
        await this.migrationRunner.run(migration);
      }
    }
  }

  async transaction<T>(fn: () => T): Promise<T> {
    const stmt = this.db.prepare('BEGIN TRANSACTION');
    try {
      stmt.run();
      const result = fn();
      this.db.prepare('COMMIT').run();
      return result;
    } catch (error) {
      this.db.prepare('ROLLBACK').run();
      throw error;
    }
  }
}
```

---

## Migration System

### Migration File Structure

Each migration is a SQL file with consistent naming:
`NNN_migration_name.sql`

**Example Migration (001_initial_schema.sql):**
```sql
-- Migration 001: Initial Database Schema
-- This migration creates all core tables and indexes

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Core tables
CREATE TABLE notebooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  parent_id TEXT,
  position INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (parent_id) REFERENCES notebooks(id) ON DELETE CASCADE
);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content TEXT NOT NULL DEFAULT '',
  notebook_id TEXT,
  is_favorite INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  is_archived INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  deleted_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE SET NULL
);

-- Additional tables...

-- Indexes for performance
CREATE INDEX idx_notes_notebook ON notes(notebook_id);
CREATE INDEX idx_notes_updated ON notes(updated_at DESC);

-- Migration complete
-- Schema version: 1
```

### MigrationRunner Implementation

```typescript
class MigrationRunner {
  private db: Database;
  private migrationsDir: string;

  constructor(db: Database, migrationsDir: string) {
    this.db = db;
    this.migrationsDir = migrationsDir;
    this.ensureMigrationsTable();
  }

  private ensureMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        checksum TEXT NOT NULL
      );
    `);
  }

  async getPendingMigrations(): Promise<Migration[]> {
    // Get all migration files from disk
    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => f.match(/^\d+_.+\.sql$/))
      .sort();

    // Get applied migrations from database
    const applied = this.db.prepare(
      'SELECT version FROM schema_migrations'
    ).all() as { version: number }[];

    const appliedVersions = new Set(applied.map(m => m.version));

    // Return migrations not yet applied
    return files
      .filter(f => !appliedVersions.has(this.getVersion(f)))
      .map(f => ({
        version: this.getVersion(f),
        name: this.getName(f),
        path: path.join(this.migrationsDir, f)
      }));
  }

  async run(migration: Migration): Promise<void> {
    try {
      // Read migration file
      const sql = fs.readFileSync(migration.path, 'utf-8');
      const checksum = this.calculateChecksum(sql);

      // Begin transaction
      this.db.prepare('BEGIN TRANSACTION').run();

      // Execute SQL statements
      const statements = sql.split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'));

      for (const statement of statements) {
        this.db.exec(statement);
      }

      // Record migration
      this.db.prepare(`
        INSERT INTO schema_migrations (version, name, checksum)
        VALUES (?, ?, ?)
      `).run(migration.version, migration.name, checksum);

      // Commit transaction
      this.db.prepare('COMMIT').run();

      logger.info(`Migration ${migration.version} applied: ${migration.name}`);
    } catch (error) {
      this.db.prepare('ROLLBACK').run();
      throw new MigrationError(`Failed to apply migration ${migration.version}`, error);
    }
  }

  private getVersion(filename: string): number {
    return parseInt(filename.split('_')[0]);
  }

  private getName(filename: string): string {
    return filename.replace(/^\d+_/, '').replace('.sql', '');
  }

  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
```

---

## Repository Implementation

### BaseRepository Pattern

```typescript
abstract class BaseRepository<T> {
  protected db: Database;
  abstract tableName: string;

  constructor(db: Database) {
    this.db = db;
  }

  findById(id: string): T | null {
    const stmt = this.db.prepare(
      `SELECT * FROM ${this.tableName} WHERE id = ?`
    );
    return stmt.get(id) as T | null;
  }

  findAll(options?: QueryOptions): T[] {
    let query = `SELECT * FROM ${this.tableName}`;
    const params: any[] = [];

    if (options?.where) {
      query += ` WHERE ${this.buildWhereClause(options.where, params)}`;
    }

    if (options?.sort) {
      query += ` ORDER BY ${options.sort.field} ${options.sort.order || 'ASC'}`;
    }

    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    if (options?.offset) {
      query += ` OFFSET ${options.offset}`;
    }

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as T[];
  }

  create(data: Partial<T>): T {
    const id = nanoid();
    const now = Math.floor(Date.now() / 1000);

    const fields = Object.keys(data);
    const placeholders = fields.map(() => '?').join(',');

    const query = `
      INSERT INTO ${this.tableName}
      (id, ${fields.join(',')}, created_at, updated_at)
      VALUES (?, ${placeholders}, ?, ?)
    `;

    const values = [id, ...Object.values(data), now, now];
    const stmt = this.db.prepare(query);
    stmt.run(...values);

    return this.findById(id)!;
  }

  update(id: string, data: Partial<T>): T {
    const now = Math.floor(Date.now() / 1000);

    const updates = Object.keys(data)
      .map(key => `${key} = ?`)
      .join(',');

    const query = `
      UPDATE ${this.tableName}
      SET ${updates}, updated_at = ?
      WHERE id = ?
    `;

    const values = [...Object.values(data), now, id];
    const stmt = this.db.prepare(query);
    stmt.run(...values);

    return this.findById(id)!;
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
    const result = stmt.run(id);
    return (result.changes || 0) > 0;
  }

  transaction<R>(callback: () => R): R {
    this.db.prepare('BEGIN TRANSACTION').run();
    try {
      const result = callback();
      this.db.prepare('COMMIT').run();
      return result;
    } catch (error) {
      this.db.prepare('ROLLBACK').run();
      throw error;
    }
  }

  batchCreate(items: Partial<T>[]): T[] {
    return this.transaction(() => {
      return items.map(item => this.create(item));
    });
  }

  private buildWhereClause(where: Record<string, any>, params: any[]): string {
    return Object.entries(where)
      .map(([key, value]) => {
        params.push(value);
        return `${key} = ?`;
      })
      .join(' AND ');
  }
}
```

### NoteRepository Implementation

```typescript
class NoteRepository extends BaseRepository<Note> {
  tableName = 'notes';

  findByNotebook(notebookId: string): Note[] {
    const stmt = this.db.prepare(
      'SELECT * FROM notes WHERE notebook_id = ? ORDER BY updated_at DESC'
    );
    return stmt.all(notebookId) as Note[];
  }

  findByTag(tagId: string): Note[] {
    const stmt = this.db.prepare(`
      SELECT n.* FROM notes n
      JOIN note_tags nt ON n.id = nt.note_id
      WHERE nt.tag_id = ?
      ORDER BY n.updated_at DESC
    `);
    return stmt.all(tagId) as Note[];
  }

  searchFullText(query: string, limit: number = 50): Note[] {
    const stmt = this.db.prepare(`
      SELECT n.* FROM notes n
      JOIN notes_fts fts ON n.rowid = fts.rowid
      WHERE notes_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
    return stmt.all(query, limit) as Note[];
  }

  getFavorites(): Note[] {
    const stmt = this.db.prepare(
      'SELECT * FROM notes WHERE is_favorite = 1 ORDER BY updated_at DESC'
    );
    return stmt.all() as Note[];
  }

  getRecent(limit: number = 20): Note[] {
    const stmt = this.db.prepare(`
      SELECT * FROM notes
      WHERE is_deleted = 0
      ORDER BY updated_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as Note[];
  }

  getDeleted(): Note[] {
    const stmt = this.db.prepare(
      'SELECT * FROM notes WHERE is_deleted = 1 ORDER BY deleted_at DESC'
    );
    return stmt.all() as Note[];
  }

  permanentDelete(id: string): boolean {
    return this.transaction(() => {
      // Delete attachments
      this.db.prepare('DELETE FROM attachments WHERE note_id = ?').run(id);
      // Delete versions
      this.db.prepare('DELETE FROM note_versions WHERE note_id = ?').run(id);
      // Delete tags
      this.db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(id);
      // Delete links
      this.db.prepare('DELETE FROM note_links WHERE source_note_id = ? OR target_note_id = ?')
        .run(id, id);
      // Delete note
      return this.delete(id);
    });
  }

  getBacklinks(noteId: string): Note[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT n.* FROM notes n
      JOIN note_links nl ON n.id = nl.source_note_id
      WHERE nl.target_note_id = ?
      ORDER BY n.updated_at DESC
    `);
    return stmt.all(noteId) as Note[];
  }
}
```

---

## IPC Handler Setup

### Base Handler Pattern

```typescript
type IpcHandler<Req = any, Res = any> = (event: IpcMainInvokeEvent, request: Req) => Promise<Res> | Res;

class IpcHandlerRegistry {
  private handlers = new Map<string, IpcHandler>();

  register<Req, Res>(channel: string, handler: IpcHandler<Req, Res>): void {
    ipcMain.handle(channel, handler);
    this.handlers.set(channel, handler);
  }

  listen<Data>(channel: string, listener: (event: IpcMainEvent, data: Data) => void): void {
    ipcMain.on(channel, listener);
  }

  async invoke<Res>(channel: string, data?: any): Promise<Res> {
    if (!mainWindow) throw new Error('Main window not found');
    return mainWindow.webContents.invoke(channel, data);
  }

  broadcast<Data>(channel: string, data: Data): void {
    mainWindow?.webContents.send(channel, data);
    if (mainWindow?.webContents) {
      mainWindow.webContents.send(channel, data);
    }
  }
}

const registry = new IpcHandlerRegistry();
```

### Note Handler Example

```typescript
function registerNoteHandlers(repositories: Repositories, registry: IpcHandlerRegistry): void {
  registry.register('notes:create', async (event, request: CreateNoteRequest) => {
    try {
      const note = repositories.note.create({
        title: request.title || 'Untitled',
        content: request.content || '',
        notebook_id: request.notebook_id || null,
      });

      // Add tags if provided
      if (request.tags?.length) {
        for (const tagId of request.tags) {
          repositories.note.addTag(note.id, tagId);
        }
      }

      // Generate embedding and store in vector DB
      if (note.content) {
        const embedding = await embeddingService.generate(note.content);
        await vectorStore.insert(note.id, embedding);
      }

      // Broadcast to all windows
      registry.broadcast('notes:created', { note });

      return note;
    } catch (error) {
      throw new IpcError('INTERNAL_ERROR', 'Failed to create note', error);
    }
  });

  registry.register('notes:update', async (event, request: UpdateNoteRequest) => {
    try {
      const oldNote = repositories.note.findById(request.id);
      if (!oldNote) throw new NotFoundError('Note not found');

      // Create version snapshot if content changed
      if (request.content && request.content !== oldNote.content) {
        repositories.version.createVersion(oldNote.id, oldNote.title, oldNote.content);

        // Update embedding
        const embedding = await embeddingService.generate(request.content);
        await vectorStore.update(oldNote.id, embedding);
      }

      const note = repositories.note.update(request.id, request);

      registry.broadcast('notes:updated', { note });

      return note;
    } catch (error) {
      throw handleIpcError(error);
    }
  });

  // Additional handlers: delete, get, getAll, favorite, pin, archive, getVersions, restoreVersion
}
```

---

## React Component Structure

### Main Layout Component

```typescript
export function MainLayout() {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const { notes, loading } = useNotes();
  const { notebooks } = useNotebooks();

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-slate-950">
      {/* Title Bar */}
      <TitleBar />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar>
          <NotebookTree notebooks={notebooks} />
          <NoteList
            notes={notes}
            selectedNoteId={selectedNoteId}
            onNoteSelect={setSelectedNoteId}
          />
        </Sidebar>

        {/* Editor */}
        {selectedNoteId && (
          <NoteEditor
            noteId={selectedNoteId}
            onClose={() => setSelectedNoteId(null)}
          />
        )}
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}
```

### Zustand Store Pattern

```typescript
interface NoteStore {
  notes: Note[];
  selectedNoteId: string | null;
  draft: Partial<Note>;
  loading: boolean;
  error: string | null;

  // Actions
  loadNotes: () => Promise<void>;
  createNote: (note: CreateNoteRequest) => Promise<Note>;
  updateNote: (noteId: string, changes: Partial<Note>) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  setSelectedNote: (noteId: string | null) => void;
  updateDraft: (changes: Partial<Note>) => void;
  clearDraft: () => void;
}

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: [],
  selectedNoteId: null,
  draft: {},
  loading: false,
  error: null,

  loadNotes: async () => {
    set({ loading: true });
    try {
      const notes = await ipcInvoke('notes:getAll', {});
      set({ notes, error: null });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },

  createNote: async (request) => {
    try {
      const note = await ipcInvoke('notes:create', request);
      set(state => ({
        notes: [note, ...state.notes],
        selectedNoteId: note.id,
      }));
      return note;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  updateNote: async (noteId, changes) => {
    try {
      const note = await ipcInvoke('notes:update', { id: noteId, ...changes });
      set(state => ({
        notes: state.notes.map(n => n.id === noteId ? note : n),
      }));
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteNote: async (noteId) => {
    try {
      await ipcInvoke('notes:delete', { id: noteId });
      set(state => ({
        notes: state.notes.filter(n => n.id !== noteId),
        selectedNoteId: state.selectedNoteId === noteId ? null : state.selectedNoteId,
      }));
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  setSelectedNote: (noteId) => set({ selectedNoteId: noteId }),
  updateDraft: (changes) => set(state => ({
    draft: { ...state.draft, ...changes }
  })),
  clearDraft: () => set({ draft: {} }),
}));
```

---

## Development Workflow

### Development Server

```bash
# Terminal 1: Start Vite dev server for renderer
npm run dev:renderer

# Terminal 2: Start Electron with main process
npm run dev:electron

# Or combined (in scripts)
npm run dev
```

### Hot Module Replacement (HMR)

Configure Vite to support HMR for renderer process:

```typescript
export default defineConfig({
  server: {
    middlewareMode: true,
    hmr: {
      host: 'localhost',
      port: 5173,
    },
  },
});
```

### Database Seeding

For development, seed test data:

```typescript
function seedDatabase(db: Database) {
  const notebookRepo = new NotebookRepository(db);
  const noteRepo = new NoteRepository(db);
  const tagRepo = new TagRepository(db);

  // Create notebooks
  const workNotebook = notebookRepo.create({
    name: 'Work',
    icon: '💼',
    color: '#3b82f6',
  });

  const personalNotebook = notebookRepo.create({
    name: 'Personal',
    icon: '📝',
    color: '#ec4899',
  });

  // Create tags
  const todoTag = tagRepo.create({
    name: 'todo',
    color: '#f59e0b',
  });

  // Create sample notes
  for (let i = 0; i < 10; i++) {
    noteRepo.create({
      title: `Sample Note ${i + 1}`,
      content: `# Sample Note ${i + 1}\n\nThis is sample content...`,
      notebook_id: i % 2 === 0 ? workNotebook.id : personalNotebook.id,
    });
  }
}
```

### Debugging

Set up debugging with Chrome DevTools:

```typescript
// In main.ts
app.on('ready', () => {
  mainWindow = new BrowserWindow({
    webPreferences: {
      devTools: true,
      preload: path.join(__dirname, 'preload.ts'),
    },
  });

  if (isDevelopment) {
    mainWindow.webContents.openDevTools();
  }
});
```

---

## Testing Strategy

### Unit Testing

Test repositories and services independently:

```typescript
describe('NoteRepository', () => {
  let db: Database;
  let repo: NoteRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    initializeSchema(db);
    repo = new NoteRepository(db);
  });

  test('should create a note', () => {
    const note = repo.create({
      title: 'Test Note',
      content: 'Test content',
    });

    expect(note.id).toBeDefined();
    expect(note.title).toBe('Test Note');
  });

  test('should find note by id', () => {
    const created = repo.create({ title: 'Test' });
    const found = repo.findById(created.id);

    expect(found).toEqual(created);
  });
});
```

### Integration Testing

Test IPC handlers with actual database:

```typescript
describe('Note IPC Handlers', () => {
  let databases: Databases;

  beforeEach(async () => {
    databases = new Databases(':memory:');
    await databases.initialize();
  });

  test('should create note via IPC', async () => {
    const result = await ipcHandler('notes:create', {
      title: 'Test',
      content: 'Content',
    });

    expect(result.id).toBeDefined();
    expect(result.title).toBe('Test');
  });
});
```

---

## Deployment

### Building for Production

```bash
# Build renderer and main process
npm run build

# Package as distributable
npm run package

# Creates:
# - dist/Stone-x.x.x.dmg (macOS)
# - dist/Stone-x.x.x.exe (Windows)
# - dist/Stone-x.x.x.AppImage (Linux)
```

### Electron Builder Configuration

```yaml
# electron-builder.yml
appId: com.stone.app
productName: Stone

directories:
  buildResources: assets
  output: dist

files:
  - dist/**/*
  - node_modules/**/*
  - package.json

mac:
  target: [dmg, zip]
  category: public.app-categories.productivity

win:
  target: [nsis, portable]

linux:
  target: [AppImage, deb]
```

---

## Rollback Strategy

### Database Rollback

If a migration fails during production:

```typescript
async function rollbackMigration() {
  // 1. Restore from pre-migration backup
  const backup = await backupManager.getLatestBackup('pre-migration');
  await backupManager.restore(backup.id);

  // 2. Verify integrity
  const result = await db.checkIntegrity();
  if (!result.ok) {
    throw new Error('Database integrity check failed');
  }

  // 3. Update schema_migrations
  const migrationVersion = backup.schema_version;
  await db.prepare(
    'DELETE FROM schema_migrations WHERE version > ?'
  ).run(migrationVersion);
}
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-29
**Status:** Complete - Ready for Implementation
