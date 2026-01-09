/**
 * NoteRepository Integration Tests
 *
 * Tests the NoteRepository adapter with a real SQLite in-memory database.
 * Uses actual Drizzle ORM with libsql to verify database interactions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { nanoid } from 'nanoid';
import { NoteRepository } from '../../../../../src/main/adapters/out/persistence/NoteRepository';
import { workspaces, notebooks } from '../../../../../src/main/shared';
import { NoteEntity } from '../../../../../src/main/domain/entities/Note';
import type { IFileStorage, IMarkdownProcessor } from '../../../../../src/main/domain';

function createNote(props: { title: string; workspaceId: string; filePath: string; notebookId?: string }) {
  return NoteEntity.create({
    id: nanoid(),
    title: props.title,
    workspaceId: props.workspaceId,
    filePath: props.filePath,
    notebookId: props.notebookId,
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

function createMockMarkdownProcessor(): IMarkdownProcessor {
  return {
    markdownToHtml: vi.fn().mockResolvedValue('<h1>Test Content</h1>'),
    htmlToMarkdown: vi.fn().mockReturnValue('# Test Content'),
    parseFrontmatter: vi.fn().mockReturnValue({ content: '# Test', metadata: {} }),
    updateFrontmatter: vi.fn().mockReturnValue('---\n---\n# Test'),
    extractTitle: vi.fn().mockReturnValue('Test'),
    extractPlainText: vi.fn().mockReturnValue('Test Content'),
    extractLinks: vi.fn().mockReturnValue([]),
    extractWikiLinks: vi.fn().mockReturnValue([]),
    htmlToPlainText: vi.fn().mockReturnValue('Test Content'),
  };
}

describe('NoteRepository Integration', () => {
  let db: ReturnType<typeof drizzle>;
  let client: Client;
  let repository: NoteRepository;
  let fileStorage: IFileStorage;
  let markdownProcessor: IMarkdownProcessor;

  const testWorkspaceId = 'ws-test-1';
  const testNotebookId = 'nb-test-1';

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    client = testDb.client;

    fileStorage = createMockFileStorage();
    markdownProcessor = createMockMarkdownProcessor();

    repository = new NoteRepository({
      db: db as any,
      fileStorage,
      markdownProcessor,
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
  });

  describe('getContentById', () => {
    it('returns HTML content for note', async () => {
      const note = createNote({
        title: 'With Content',
        workspaceId: testWorkspaceId,
        filePath: 'content.md',
      });
      await repository.save(note);

      const content = await repository.getContentById(note.id);

      expect(content).toBe('<h1>Test Content</h1>');
      expect(fileStorage.read).toHaveBeenCalledWith('/test/workspace/content.md');
      expect(markdownProcessor.markdownToHtml).toHaveBeenCalledWith('# Test Content');
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

  describe('embedding operations', () => {
    it('updates and retrieves embedding', async () => {
      const note = createNote({
        title: 'Embedded',
        workspaceId: testWorkspaceId,
        filePath: 'embed.md',
      });
      await repository.save(note);

      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      await repository.updateEmbedding(note.id, embedding);

      const retrieved = await repository.getEmbedding(note.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.length).toBe(5);
      // Float32 precision
      expect(retrieved![0]).toBeCloseTo(0.1, 5);
    });

    it('returns null when no embedding', async () => {
      const note = createNote({
        title: 'No Embed',
        workspaceId: testWorkspaceId,
        filePath: 'noembed.md',
      });
      await repository.save(note);

      const embedding = await repository.getEmbedding(note.id);
      expect(embedding).toBeNull();
    });
  });
});
