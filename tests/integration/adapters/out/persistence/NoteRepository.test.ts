/**
 * NoteRepository Integration Tests
 *
 * Tests the NoteRepository adapter with a real SQLite in-memory database.
 * Uses actual Drizzle ORM with libsql to verify database interactions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createClient, type Client } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { nanoid } from 'nanoid';
import { NoteRepository } from '../../../../../src/main/adapters/out/persistence/NoteRepository';
import { workspaces, notebooks, notes } from '../../../../../src/main/shared';
import { NoteEntity } from '../../../../../src/main/domain/entities/Note';
import type { IFileStorage } from '../../../../../src/main/domain';

function createNote(props: { title: string; workspaceId: string; filePath: string; notebookId?: string }) {
  return NoteEntity.create({
    id: nanoid(),
    title: props.title,
    workspaceId: props.workspaceId,
    filePath: props.filePath,
    notebookId: props.notebookId,
  });
}

async function insertWorkspace(db: ReturnType<typeof drizzle>, id: string, folderPath: string) {
  await db.insert(workspaces).values({
    id,
    name: `Workspace ${id}`,
    folderPath,
    isActive: false,
    createdAt: new Date(),
    lastAccessedAt: new Date(),
  });
}

async function createTestDatabase() {
  const client = createClient({ url: ':memory:' });
  const db = drizzle(client);

  // Create tables manually for in-memory database
  await client.execute(`
    CREATE TABLE workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      folder_path TEXT NOT NULL UNIQUE,
      is_active INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      last_accessed_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE notebooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
      folder_path TEXT,
      icon TEXT DEFAULT '📁',
      color TEXT DEFAULT '#3b82f6',
      position INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE notes (
      id TEXT PRIMARY KEY,
      title TEXT DEFAULT 'Untitled',
      file_path TEXT,
      notebook_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL,
      workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
      is_favorite INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      deleted_at INTEGER,
      embedding BLOB,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  await client.execute(`CREATE INDEX idx_notes_workspace_id ON notes(workspace_id)`);
  await client.execute(`CREATE INDEX idx_notes_notebook_id ON notes(notebook_id)`);
  await client.execute(`CREATE INDEX idx_notes_file_path ON notes(file_path)`);

  return { db, client };
}

function createMockFileStorage(): IFileStorage {
  return {
    read: vi.fn().mockResolvedValue('# Test Content'),
    write: vi.fn().mockResolvedValue(undefined),
    writeBytes: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(true),
    rename: vi.fn().mockResolvedValue(undefined),
    createDirectory: vi.fn().mockResolvedValue(undefined),
    deleteDirectory: vi.fn().mockResolvedValue(undefined),
    listFiles: vi.fn().mockResolvedValue([]),
    glob: vi.fn().mockResolvedValue([]),
    getFileInfo: vi.fn().mockResolvedValue({
      path: '/test/path',
      name: 'test.md',
      isDirectory: false,
      size: 100,
      createdAt: new Date(),
      modifiedAt: new Date(),
    }),
    copy: vi.fn().mockResolvedValue(undefined),
    watch: vi.fn().mockReturnValue(() => {}),
  };
}

describe('NoteRepository Integration', () => {
  let db: ReturnType<typeof drizzle>;
  let client: Client;
  let repository: NoteRepository;
  let fileStorage: IFileStorage;

  const testWorkspaceId = 'ws-test-1';
  const testNotebookId = 'nb-test-1';

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    client = testDb.client;

    fileStorage = createMockFileStorage();

    repository = new NoteRepository({
      db: db as any,
      fileStorage,
      getWorkspacePath: () => '/test/workspace',
    });

    // Insert test workspace
    await db.insert(workspaces).values({
      id: testWorkspaceId,
      name: 'Test Workspace',
      folderPath: '/test/workspace',
      isActive: true,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    });

    // Insert test notebook
    await db.insert(notebooks).values({
      id: testNotebookId,
      name: 'Test Notebook',
      workspaceId: testWorkspaceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(() => {
    client.close();
  });

  describe('save', () => {
    it('inserts a new note', async () => {
      const note = createNote({
        title: 'New Note',
        workspaceId: testWorkspaceId,
        filePath: 'notes/new-note.md',
      });

      await repository.save(note);

      const saved = await repository.findById(note.id);
      expect(saved).not.toBeNull();
      expect(saved!.title).toBe('New Note');
      expect(saved!.workspaceId).toBe(testWorkspaceId);
    });

    it('updates an existing note', async () => {
      const note = createNote({
        title: 'Original Title',
        workspaceId: testWorkspaceId,
        filePath: 'notes/test.md',
      });

      await repository.save(note);

      // Update the note
      note.updateTitle('Updated Title');
      await repository.save(note);

      const updated = await repository.findById(note.id);
      expect(updated!.title).toBe('Updated Title');
    });
  });

  describe('findById', () => {
    it('returns note when found', async () => {
      const note = createNote({
        title: 'Find Me',
        workspaceId: testWorkspaceId,
        filePath: 'notes/findme.md',
      });
      await repository.save(note);

      const found = await repository.findById(note.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(note.id);
      expect(found!.title).toBe('Find Me');
    });

    it('returns null when not found', async () => {
      const found = await repository.findById('nonexistent-id');
      expect(found).toBeNull();
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      const notesToCreate = [
        createNote({ title: 'Note 1', workspaceId: testWorkspaceId, filePath: 'n1.md' }),
        createNote({ title: 'Note 2', workspaceId: testWorkspaceId, filePath: 'n2.md' }),
        createNote({ title: 'Note 3', workspaceId: testWorkspaceId, filePath: 'n3.md' }),
      ];

      for (const note of notesToCreate) {
        await repository.save(note);
      }
    });

    it('returns all notes', async () => {
      const result = await repository.findAll();
      expect(result.length).toBe(3);
    });

    it('filters by workspaceId', async () => {
      const result = await repository.findAll({ workspaceId: testWorkspaceId });
      expect(result.length).toBe(3);

      const empty = await repository.findAll({ workspaceId: 'other-ws' });
      expect(empty.length).toBe(0);
    });

    it('applies limit', async () => {
      const result = await repository.findAll({ limit: 2 });
      expect(result.length).toBe(2);
    });

    it('applies limit with offset', async () => {
      const result = await repository.findAll({
        limit: 1,
        offset: 1,
        orderBy: 'title',
        orderDirection: 'asc',
      });
      expect(result.length).toBe(1);
    });

    it('filters by isFavorite', async () => {
      const favNote = createNote({
        title: 'Favorite',
        workspaceId: testWorkspaceId,
        filePath: 'fav.md',
      });
      favNote.toggleFavorite();
      await repository.save(favNote);

      const favorites = await repository.findAll({ isFavorite: true });
      expect(favorites.length).toBe(1);
      expect(favorites[0].title).toBe('Favorite');
    });

    it('filters by notebookId', async () => {
      const notebookNote = createNote({
        title: 'Notebook',
        workspaceId: testWorkspaceId,
        notebookId: testNotebookId,
        filePath: 'notebook-filter.md',
      });
      await repository.save(notebookNote);

      const result = await repository.findAll({ notebookId: testNotebookId });
      expect(result.find((n) => n.notebookId === testNotebookId)).toBeDefined();
    });

    it('filters notes without notebook when notebookId is null', async () => {
      const looseNote = createNote({
        title: 'Loose',
        workspaceId: testWorkspaceId,
        filePath: 'loose-filter.md',
      });
      await repository.save(looseNote);

      const result = await repository.findAll({ notebookId: null });
      expect(result.find((n) => n.notebookId === null)).toBeDefined();
    });

    it('filters by isPinned', async () => {
      const pinned = createNote({
        title: 'Pinned Filter',
        workspaceId: testWorkspaceId,
        filePath: 'pinned-filter.md',
      });
      pinned.togglePinned();
      await repository.save(pinned);

      const result = await repository.findAll({ isPinned: true });
      expect(result.find((n) => n.title === 'Pinned Filter')).toBeDefined();
    });

    it('filters by isArchived', async () => {
      const archived = createNote({
        title: 'Archived Filter',
        workspaceId: testWorkspaceId,
        filePath: 'archived-filter.md',
      });
      archived.archive();
      await repository.save(archived);

      const result = await repository.findAll({ isArchived: true });
      expect(result.find((n) => n.title === 'Archived Filter')).toBeDefined();
    });

    it('filters by isDeleted', async () => {
      const deleted = createNote({
        title: 'Deleted Filter',
        workspaceId: testWorkspaceId,
        filePath: 'deleted-filter.md',
      });
      deleted.delete();
      await repository.save(deleted);

      const result = await repository.findAll({ isDeleted: true });
      expect(result.find((n) => n.title === 'Deleted Filter')).toBeDefined();
    });

    it('supports ordering by title and createdAt', async () => {
      const alpha = createNote({
        title: 'Alpha',
        workspaceId: testWorkspaceId,
        filePath: 'alpha.md',
      });
      const beta = createNote({
        title: 'Beta',
        workspaceId: testWorkspaceId,
        filePath: 'beta.md',
      });
      await repository.save(beta);
      await repository.save(alpha);

      const orderedByTitle = await repository.findAll({ orderBy: 'title', orderDirection: 'asc' });
      expect(orderedByTitle[0].title).toBe('Alpha');

      const orderedByCreatedAt = await repository.findAll({
        orderBy: 'createdAt',
        orderDirection: 'desc',
      });
      expect(orderedByCreatedAt.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('findByNotebookId', () => {
    it('returns notes in notebook', async () => {
      const note = createNote({
        title: 'In Notebook',
        workspaceId: testWorkspaceId,
        notebookId: testNotebookId,
        filePath: 'nb/test.md',
      });
      await repository.save(note);

      const result = await repository.findByNotebookId(testNotebookId);
      expect(result.length).toBe(1);
      expect(result[0].notebookId).toBe(testNotebookId);
    });

    it('returns notes without notebook when null', async () => {
      const note = createNote({
        title: 'No Notebook',
        workspaceId: testWorkspaceId,
        filePath: 'loose.md',
      });
      await repository.save(note);

      const result = await repository.findByNotebookId(null, testWorkspaceId);
      expect(result.length).toBe(1);
      expect(result[0].notebookId).toBeNull();
    });
  });

  describe('findByFilePath', () => {
    it('finds note by file path', async () => {
      const note = createNote({
        title: 'By Path',
        workspaceId: testWorkspaceId,
        filePath: 'specific/path.md',
      });
      await repository.save(note);

      const found = await repository.findByFilePath('specific/path.md');
      expect(found).not.toBeNull();
      expect(found!.title).toBe('By Path');
    });

    it('returns null for unknown path', async () => {
      const found = await repository.findByFilePath('unknown/path.md');
      expect(found).toBeNull();
    });

    it('respects workspace filter', async () => {
      const note = createNote({
        title: 'Workspace Scoped',
        workspaceId: 'other-workspace',
        filePath: 'scoped.md',
      });
      // Need a workspace row to satisfy FK
      await db.insert(workspaces).values({
        id: 'other-workspace',
        name: 'Other Workspace',
        folderPath: '/test/other-workspace',
        isActive: false,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
      });
      await repository.save(note);

      const found = await repository.findByFilePath('scoped.md', testWorkspaceId);
      expect(found).toBeNull();
    });
  });

  describe('delete', () => {
    it('removes note from database', async () => {
      const note = createNote({
        title: 'To Delete',
        workspaceId: testWorkspaceId,
        filePath: 'delete.md',
      });
      await repository.save(note);

      await repository.delete(note.id);

      const found = await repository.findById(note.id);
      expect(found).toBeNull();
    });
  });

  describe('searchByTitle', () => {
    beforeEach(async () => {
      const notesToCreate = [
        createNote({ title: 'JavaScript Guide', workspaceId: testWorkspaceId, filePath: 'js.md' }),
        createNote({ title: 'TypeScript Tips', workspaceId: testWorkspaceId, filePath: 'ts.md' }),
        createNote({ title: 'Python Basics', workspaceId: testWorkspaceId, filePath: 'py.md' }),
      ];
      for (const note of notesToCreate) {
        await repository.save(note);
      }
    });

    it('finds notes by title substring', async () => {
      const result = await repository.searchByTitle({ query: 'Script' });
      expect(result.length).toBe(2);
    });

    it('respects limit', async () => {
      const result = await repository.searchByTitle({ query: 'Script', limit: 1 });
      expect(result.length).toBe(1);
    });

    it('filters by workspaceId', async () => {
      const otherWorkspaceId = 'ws-search';
      await insertWorkspace(db, otherWorkspaceId, '/test/ws-search');
      const note = createNote({
        title: 'Script Outside',
        workspaceId: otherWorkspaceId,
        filePath: 'outside.md',
      });
      await repository.save(note);

      const result = await repository.searchByTitle({ query: 'Script', workspaceId: testWorkspaceId });
      expect(result.find((n) => n.workspaceId === otherWorkspaceId)).toBeUndefined();
    });
  });

  describe('count', () => {
    it('returns total count', async () => {
      const notesToCreate = [
        createNote({ title: 'Note 1', workspaceId: testWorkspaceId, filePath: 'n1.md' }),
        createNote({ title: 'Note 2', workspaceId: testWorkspaceId, filePath: 'n2.md' }),
      ];
      for (const note of notesToCreate) {
        await repository.save(note);
      }

      const count = await repository.count();
      expect(count).toBe(2);
    });

    it('filters count by workspace', async () => {
      const note = createNote({
        title: 'Test',
        workspaceId: testWorkspaceId,
        filePath: 'test.md',
      });
      await repository.save(note);

      const count = await repository.count({ workspaceId: testWorkspaceId });
      expect(count).toBe(1);

      const emptyCount = await repository.count({ workspaceId: 'other' });
      expect(emptyCount).toBe(0);
    });

    it('counts by notebook filters and deleted flag', async () => {
      const note = createNote({
        title: 'Notebook note',
        workspaceId: testWorkspaceId,
        notebookId: testNotebookId,
        filePath: 'notebook.md',
      });
      note.delete();
      await repository.save(note);

      const countNotebook = await repository.count({ notebookId: testNotebookId });
      expect(countNotebook).toBe(1);

      const countDeleted = await repository.count({ isDeleted: true });
      expect(countDeleted).toBeGreaterThan(0);
    });

    it('counts notes without notebook when notebookId is null', async () => {
      const note = createNote({
        title: 'No Notebook Count',
        workspaceId: testWorkspaceId,
        filePath: 'no-notebook-count.md',
      });
      await repository.save(note);

      const count = await repository.count({ notebookId: null });
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('exists', () => {
    it('returns true when note exists', async () => {
      const note = createNote({
        title: 'Exists',
        workspaceId: testWorkspaceId,
        filePath: 'exists.md',
      });
      await repository.save(note);

      const exists = await repository.exists(note.id);
      expect(exists).toBe(true);
    });

    it('returns false when note does not exist', async () => {
      const exists = await repository.exists('nonexistent');
      expect(exists).toBe(false);
    });
  });

  describe('findFavorites', () => {
    it('returns only favorite notes', async () => {
      const regular = createNote({
        title: 'Regular',
        workspaceId: testWorkspaceId,
        filePath: 'regular.md',
      });
      const favorite = createNote({
        title: 'Favorite',
        workspaceId: testWorkspaceId,
        filePath: 'favorite.md',
      });
      favorite.toggleFavorite();

      await repository.save(regular);
      await repository.save(favorite);

      const favorites = await repository.findFavorites();
      expect(favorites.length).toBe(1);
      expect(favorites[0].isFavorite).toBe(true);
    });

    it('scopes favorites by workspace', async () => {
      const otherWorkspaceId = 'ws-other-fav';
      await insertWorkspace(db, otherWorkspaceId, '/test/other-fav');
      const favorite = createNote({
        title: 'Other Fav',
        workspaceId: otherWorkspaceId,
        filePath: 'other-fav.md',
      });
      favorite.toggleFavorite();
      await repository.save(favorite);

      const favorites = await repository.findFavorites(testWorkspaceId);
      expect(favorites.find((n) => n.workspaceId === otherWorkspaceId)).toBeUndefined();
    });
  });

  describe('findPinned', () => {
    it('returns only pinned notes', async () => {
      const pinned = createNote({
        title: 'Pinned',
        workspaceId: testWorkspaceId,
        filePath: 'pinned.md',
      });
      pinned.togglePinned();
      await repository.save(pinned);

      const pinnedNotes = await repository.findPinned();
      expect(pinnedNotes.length).toBe(1);
      expect(pinnedNotes[0].isPinned).toBe(true);
    });

    it('scopes pinned by workspace', async () => {
      const otherWorkspaceId = 'ws-other-pinned';
      await insertWorkspace(db, otherWorkspaceId, '/test/other-pinned');
      const pinned = createNote({
        title: 'Pinned Other',
        workspaceId: otherWorkspaceId,
        filePath: 'pinned-other.md',
      });
      pinned.togglePinned();
      await repository.save(pinned);

      const pinnedNotes = await repository.findPinned(testWorkspaceId);
      expect(pinnedNotes.find((n) => n.workspaceId === otherWorkspaceId)).toBeUndefined();
    });
  });

  describe('findArchived', () => {
    it('returns only archived notes', async () => {
      const archived = createNote({
        title: 'Archived',
        workspaceId: testWorkspaceId,
        filePath: 'archived.md',
      });
      archived.archive();
      await repository.save(archived);

      const archivedNotes = await repository.findArchived();
      expect(archivedNotes.length).toBe(1);
      expect(archivedNotes[0].isArchived).toBe(true);
    });

    it('scopes archived by workspace', async () => {
      const otherWorkspaceId = 'ws-other-archived';
      await insertWorkspace(db, otherWorkspaceId, '/test/other-archived');
      const archived = createNote({
        title: 'Archived Other',
        workspaceId: otherWorkspaceId,
        filePath: 'archived-other.md',
      });
      archived.archive();
      await repository.save(archived);

      const archivedNotes = await repository.findArchived(testWorkspaceId);
      expect(archivedNotes.find((n) => n.workspaceId === otherWorkspaceId)).toBeUndefined();
    });
  });

  describe('findDeleted', () => {
    it('returns only soft-deleted notes', async () => {
      const deleted = createNote({
        title: 'Deleted',
        workspaceId: testWorkspaceId,
        filePath: 'deleted.md',
      });
      deleted.delete();
      await repository.save(deleted);

      const deletedNotes = await repository.findDeleted();
      expect(deletedNotes.length).toBe(1);
      expect(deletedNotes[0].isDeleted).toBe(true);
    });

    it('scopes deleted by workspace', async () => {
      const otherWorkspaceId = 'ws-other-deleted';
      await insertWorkspace(db, otherWorkspaceId, '/test/other-deleted');
      const deleted = createNote({
        title: 'Deleted Other',
        workspaceId: otherWorkspaceId,
        filePath: 'deleted-other.md',
      });
      deleted.delete();
      await repository.save(deleted);

      const deletedNotes = await repository.findDeleted(testWorkspaceId);
      expect(deletedNotes.find((n) => n.workspaceId === otherWorkspaceId)).toBeUndefined();
    });
  });

  describe('getContentById', () => {
    it('returns raw markdown content for note', async () => {
      const note = createNote({
        title: 'With Content',
        workspaceId: testWorkspaceId,
        filePath: 'content.md',
      });
      await repository.save(note);

      const content = await repository.getContentById(note.id);

      expect(content).toBe('# Test Content');
      expect(fileStorage.read).toHaveBeenCalledWith('/test/workspace/content.md');
    });

    it('returns null when note not found', async () => {
      const content = await repository.getContentById('nonexistent');
      expect(content).toBeNull();
    });

    it('returns null when file does not exist', async () => {
      vi.mocked(fileStorage.exists).mockResolvedValueOnce(false);

      const note = createNote({
        title: 'Missing File',
        workspaceId: testWorkspaceId,
        filePath: 'missing.md',
      });
      await repository.save(note);

      const content = await repository.getContentById(note.id);
      expect(content).toBeNull();
    });
  });

  // Embedding storage + cosine similarity moved to IndexRepository / chunk
  // index. NoteRepository no longer owns those operations.

  describe('findRecentlyUpdated', () => {
    it('returns most recently updated notes', async () => {
      const first = createNote({
        title: 'First',
        workspaceId: testWorkspaceId,
        filePath: 'first.md',
      });
      const second = createNote({
        title: 'Second',
        workspaceId: testWorkspaceId,
        filePath: 'second.md',
      });

      await repository.save(first);
      await repository.save(second);

      // Bump updatedAt for deterministic ordering
      second.updateTitle('Second Updated');
      const future = new Date(Date.now() + 1000);
      const refreshedSecond = NoteEntity.fromPersistence({
        ...second.toPersistence(),
        updatedAt: future,
      });
      await repository.save(refreshedSecond);

      const recent = await repository.findRecentlyUpdated(1, testWorkspaceId);
      expect(recent[0].id).toBe(second.id);
    });
  });

  describe('findByWorkspaceId', () => {
    it('returns only non-deleted notes for workspace', async () => {
      const active = createNote({
        title: 'Active',
        workspaceId: testWorkspaceId,
        filePath: 'active.md',
      });
      const deleted = createNote({
        title: 'Deleted',
        workspaceId: testWorkspaceId,
        filePath: 'deleted.md',
      });
      deleted.delete();

      await repository.save(active);
      await repository.save(deleted);

      const result = await repository.findByWorkspaceId(testWorkspaceId);
      expect(result.find((n) => n.title === 'Deleted')).toBeUndefined();
    });
  });

  describe('getContentById edge cases', () => {
    it('returns null when workspace path is missing', async () => {
      const localRepo = new NoteRepository({
        db: db as any,
        fileStorage,
        getWorkspacePath: () => null,
      });
      const note = createNote({
        title: 'No Workspace',
        workspaceId: testWorkspaceId,
        filePath: 'missing-workspace.md',
      });
      await localRepo.save(note);

      const content = await localRepo.getContentById(note.id);
      expect(content).toBeNull();
    });

    it('returns null when file read is empty', async () => {
      const note = createNote({
        title: 'Empty File',
        workspaceId: testWorkspaceId,
        filePath: 'empty.md',
      });
      await repository.save(note);
      vi.mocked(fileStorage.exists).mockResolvedValueOnce(true);
      vi.mocked(fileStorage.read).mockResolvedValueOnce('');

      const content = await repository.getContentById(note.id);
      expect(content).toBeNull();
    });
  });

  describe('additional coverage branches', () => {
    it('falls back to zero when count returns empty result', async () => {
      const originalSelect = (repository as any).deps.db.select;
      (repository as any).deps.db.select = () => ({
        from: () => ({
          where: () => [],
        }),
      });

      const result = await repository.count();
      expect(result).toBe(0);

      (repository as any).deps.db.select = originalSelect;
    });

    it('handles nullish values in toNoteProps', () => {
      const row = {
        id: 'id',
        title: undefined,
        notebookId: undefined,
        workspaceId: undefined,
        filePath: undefined,
        isFavorite: undefined,
        isPinned: undefined,
        isArchived: undefined,
        isDeleted: undefined,
        deletedAt: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const noteProps = (repository as any).toNoteProps(row);
      expect(noteProps.title).toBe('Untitled');
      expect(noteProps.notebookId).toBeNull();
      expect(noteProps.workspaceId).toBeNull();
      expect(noteProps.filePath).toBeNull();
      expect(noteProps.isFavorite).toBe(false);
      expect(noteProps.isPinned).toBe(false);
      expect(noteProps.isArchived).toBe(false);
      expect(noteProps.isDeleted).toBe(false);
      expect(noteProps.deletedAt).toBeNull();
    });

    // findBySimilarity / cosineSimilarity branches now live on IndexRepository.
  });
});
