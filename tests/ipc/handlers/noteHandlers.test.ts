/**
 * Note IPC Handler Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron before importing handlers
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [
      { webContents: { send: vi.fn() } },
    ]),
    getFocusedWindow: vi.fn(() => ({
      webContents: {
        printToPDF: vi.fn(() => Promise.resolve(Buffer.from('pdf-data'))),
      },
    })),
  },
  ipcMain: {
    handle: vi.fn(),
  },
  dialog: {
    showSaveDialog: vi.fn(() => Promise.resolve({ canceled: false, filePath: '/path/to/export.html' })),
  },
  app: {
    getPath: vi.fn(() => '/tmp'),
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(() => Promise.resolve()),
  unlink: vi.fn(() => Promise.resolve()),
}));

// Mock jsdom for getAllTodos
vi.mock('jsdom', () => ({
  JSDOM: vi.fn().mockImplementation((content: string) => ({
    window: {
      document: {
        querySelectorAll: vi.fn(() => []),
      },
    },
  })),
}));

// Mock logger
vi.mock('../../../src/main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock repositories
const mockNoteRepo = {
  create: vi.fn(),
  update: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  findByTags: vi.fn(),
  findByFolder: vi.fn(),
  findByNotebook: vi.fn(),
  findByFilePath: vi.fn(),
  getContentById: vi.fn(),
  getRawContentById: vi.fn(),
  softDelete: vi.fn(),
  permanentDelete: vi.fn(),
  toggleFavorite: vi.fn(),
  togglePin: vi.fn(),
  toggleArchive: vi.fn(),
  getFavorites: vi.fn(),
  getPinned: vi.fn(),
  getDeleted: vi.fn(),
  getArchived: vi.fn(),
  getBacklinks: vi.fn(),
  getForwardLinks: vi.fn(),
  getGraphData: vi.fn(),
};

const mockTagRepo = {
  getTagsForNote: vi.fn(),
  getTagsForNotes: vi.fn(),
  setTagsForNote: vi.fn(),
};

const mockAttachmentRepo = {
  getAttachmentsForNote: vi.fn(),
  getAttachmentsForNotes: vi.fn(),
};

const mockNotebookRepo = {
  findById: vi.fn(),
  findByIds: vi.fn(),
};

const mockVersionRepo = {
  createVersion: vi.fn(),
  getVersionSummary: vi.fn(),
  findById: vi.fn(),
};

const mockWorkspaceRepo = {
  getActive: vi.fn(),
};

vi.mock('../../../src/main/repositories', () => ({
  getRepositories: vi.fn(() => ({
    note: mockNoteRepo,
    tag: mockTagRepo,
    attachment: mockAttachmentRepo,
    notebook: mockNotebookRepo,
    version: mockVersionRepo,
    workspace: mockWorkspaceRepo,
  })),
}));

// Import after mocks
import { registerNoteHandlers } from '../../../src/main/ipc/handlers/noteHandlers';
import { ipcMain, BrowserWindow, dialog } from 'electron';
import * as fs from 'fs/promises';

describe('Note IPC Handlers', () => {
  let registeredHandlers: Map<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers = new Map();

    // Capture registered handlers
    (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    });

    // Default mock implementations
    mockTagRepo.getTagsForNote.mockResolvedValue([]);
    mockTagRepo.getTagsForNotes.mockResolvedValue(new Map());
    mockAttachmentRepo.getAttachmentsForNote.mockResolvedValue([]);
    mockAttachmentRepo.getAttachmentsForNotes.mockResolvedValue(new Map());
    mockNotebookRepo.findById.mockResolvedValue(null);
    mockNotebookRepo.findByIds.mockResolvedValue(new Map());
    mockWorkspaceRepo.getActive.mockResolvedValue({ id: 'ws-1' });

    registerNoteHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('notes:create', () => {
    it('should create a note with default title', async () => {
      const mockNote = {
        id: 'note-1',
        title: 'Untitled',
        filePath: 'notes/Untitled.md',
        workspaceId: 'ws-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockNoteRepo.create.mockResolvedValue(mockNote);

      const handler = registeredHandlers.get('notes:create');
      const result = await handler({}, {});

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Untitled');
      expect(mockNoteRepo.create).toHaveBeenCalledWith({
        title: 'Untitled',
        notebookId: null,
        folderPath: undefined,
      });
    });

    it('should create a note with custom title', async () => {
      const mockNote = {
        id: 'note-1',
        title: 'My Note',
        filePath: 'notes/My Note.md',
        workspaceId: 'ws-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockNoteRepo.create.mockResolvedValue(mockNote);

      const handler = registeredHandlers.get('notes:create');
      const result = await handler({}, { title: 'My Note' });

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('My Note');
    });

    it('should create note with content', async () => {
      const mockNote = {
        id: 'note-1',
        title: 'Test',
        filePath: 'notes/Test.md',
        workspaceId: 'ws-1',
      };
      mockNoteRepo.create.mockResolvedValue(mockNote);
      mockNoteRepo.update.mockResolvedValue(mockNote);

      const handler = registeredHandlers.get('notes:create');
      await handler({}, { title: 'Test', content: '# Hello World' });

      expect(mockNoteRepo.update).toHaveBeenCalledWith('note-1', { content: '# Hello World' });
    });

    it('should create note with tags', async () => {
      const mockNote = {
        id: 'note-1',
        title: 'Test',
        filePath: 'notes/Test.md',
        workspaceId: 'ws-1',
      };
      mockNoteRepo.create.mockResolvedValue(mockNote);

      const handler = registeredHandlers.get('notes:create');
      await handler({}, { title: 'Test', tags: ['tag-1', 'tag-2'] });

      expect(mockTagRepo.setTagsForNote).toHaveBeenCalledWith('note-1', ['tag-1', 'tag-2']);
    });

    it('should create note with folder path', async () => {
      const mockNote = {
        id: 'note-1',
        title: 'Test',
        filePath: 'Personal/Test.md',
        workspaceId: 'ws-1',
      };
      mockNoteRepo.create.mockResolvedValue(mockNote);

      const handler = registeredHandlers.get('notes:create');
      await handler({}, { title: 'Test', folderPath: 'Personal' });

      expect(mockNoteRepo.create).toHaveBeenCalledWith({
        title: 'Test',
        notebookId: null,
        folderPath: 'Personal',
      });
    });

    it('should broadcast note created event', async () => {
      const mockWindow = { webContents: { send: vi.fn() } };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      const mockNote = { id: 'note-1', title: 'Test' };
      mockNoteRepo.create.mockResolvedValue(mockNote);

      const handler = registeredHandlers.get('notes:create');
      await handler({}, { title: 'Test' });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'notes:created',
        expect.objectContaining({ note: expect.any(Object) })
      );
    });
  });

  describe('notes:update', () => {
    it('should update note title', async () => {
      const oldNote = { id: 'note-1', title: 'Old Title' };
      const updatedNote = { id: 'note-1', title: 'New Title' };

      mockNoteRepo.findById.mockResolvedValue(oldNote);
      mockNoteRepo.update.mockResolvedValue(updatedNote);

      const handler = registeredHandlers.get('notes:update');
      const result = await handler({}, { id: 'note-1', title: 'New Title' });

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('New Title');
      expect(mockNoteRepo.update).toHaveBeenCalledWith('note-1', { title: 'New Title' });
    });

    it('should return error if note not found', async () => {
      mockNoteRepo.findById.mockResolvedValue(null);

      const handler = registeredHandlers.get('notes:update');
      const result = await handler({}, { id: 'non-existent', title: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should create version when content changes', async () => {
      const oldNote = { id: 'note-1', title: 'Test' };
      const updatedNote = { id: 'note-1', title: 'Test' };

      mockNoteRepo.findById.mockResolvedValue(oldNote);
      mockNoteRepo.getContentById.mockResolvedValue('Old content');
      mockNoteRepo.update.mockResolvedValue(updatedNote);

      const handler = registeredHandlers.get('notes:update');
      await handler({}, { id: 'note-1', content: 'New content' });

      expect(mockVersionRepo.createVersion).toHaveBeenCalledWith(
        'note-1',
        'Test',
        'Old content'
      );
    });

    it('should not create version if content is the same', async () => {
      const oldNote = { id: 'note-1', title: 'Test' };
      const updatedNote = { id: 'note-1', title: 'Test' };

      mockNoteRepo.findById.mockResolvedValue(oldNote);
      mockNoteRepo.getContentById.mockResolvedValue('Same content');
      mockNoteRepo.update.mockResolvedValue(updatedNote);

      const handler = registeredHandlers.get('notes:update');
      await handler({}, { id: 'note-1', content: 'Same content' });

      expect(mockVersionRepo.createVersion).not.toHaveBeenCalled();
    });

    it('should update tags', async () => {
      const oldNote = { id: 'note-1', title: 'Test' };
      const updatedNote = { id: 'note-1', title: 'Test' };

      mockNoteRepo.findById.mockResolvedValue(oldNote);
      mockNoteRepo.update.mockResolvedValue(updatedNote);

      const handler = registeredHandlers.get('notes:update');
      await handler({}, { id: 'note-1', tags: ['new-tag'] });

      expect(mockTagRepo.setTagsForNote).toHaveBeenCalledWith('note-1', ['new-tag']);
    });

    it('should update multiple fields', async () => {
      const oldNote = { id: 'note-1', title: 'Old' };
      const updatedNote = { id: 'note-1', title: 'New', isFavorite: true, isPinned: true };

      mockNoteRepo.findById.mockResolvedValue(oldNote);
      mockNoteRepo.update.mockResolvedValue(updatedNote);

      const handler = registeredHandlers.get('notes:update');
      await handler({}, {
        id: 'note-1',
        title: 'New',
        isFavorite: true,
        isPinned: true,
        isArchived: false,
      });

      expect(mockNoteRepo.update).toHaveBeenCalledWith('note-1', {
        title: 'New',
        isFavorite: true,
        isPinned: true,
        isArchived: false,
      });
    });

    it('should broadcast note updated event', async () => {
      const mockWindow = { webContents: { send: vi.fn() } };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      const note = { id: 'note-1', title: 'Test' };
      mockNoteRepo.findById.mockResolvedValue(note);
      mockNoteRepo.update.mockResolvedValue(note);

      const handler = registeredHandlers.get('notes:update');
      await handler({}, { id: 'note-1', title: 'Test' });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'notes:updated',
        expect.objectContaining({ note: expect.any(Object) })
      );
    });
  });

  describe('notes:delete', () => {
    it('should soft delete note by default', async () => {
      mockNoteRepo.softDelete.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('notes:delete');
      const result = await handler({}, { id: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(mockNoteRepo.softDelete).toHaveBeenCalledWith('note-1');
    });

    it('should permanently delete note when requested', async () => {
      mockNoteRepo.permanentDelete.mockResolvedValue(true);

      const handler = registeredHandlers.get('notes:delete');
      const result = await handler({}, { id: 'note-1', permanent: true });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(mockNoteRepo.permanentDelete).toHaveBeenCalledWith('note-1');
    });

    it('should return error if permanent delete fails', async () => {
      mockNoteRepo.permanentDelete.mockResolvedValue(false);

      const handler = registeredHandlers.get('notes:delete');
      const result = await handler({}, { id: 'non-existent', permanent: true });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should broadcast note deleted event', async () => {
      const mockWindow = { webContents: { send: vi.fn() } };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      mockNoteRepo.softDelete.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('notes:delete');
      await handler({}, { id: 'note-1' });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'notes:deleted',
        { id: 'note-1' }
      );
    });
  });

  describe('notes:get', () => {
    it('should return note with relations', async () => {
      const note = { id: 'note-1', title: 'Test', notebookId: null };
      mockNoteRepo.findById.mockResolvedValue(note);
      mockTagRepo.getTagsForNote.mockResolvedValue([{ id: 'tag-1', name: 'work' }]);
      mockAttachmentRepo.getAttachmentsForNote.mockResolvedValue([]);

      const handler = registeredHandlers.get('notes:get');
      const result = await handler({}, { id: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('note-1');
      expect(result.data.tags).toHaveLength(1);
    });

    it('should return error if note not found', async () => {
      mockNoteRepo.findById.mockResolvedValue(null);

      const handler = registeredHandlers.get('notes:get');
      const result = await handler({}, { id: 'non-existent' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should include versions when requested', async () => {
      const note = { id: 'note-1', title: 'Test' };
      mockNoteRepo.findById.mockResolvedValue(note);
      mockVersionRepo.getVersionSummary.mockResolvedValue([
        { id: 'v-1', versionNumber: 1 },
      ]);

      const handler = registeredHandlers.get('notes:get');
      const result = await handler({}, { id: 'note-1', include_versions: true });

      expect(result.success).toBe(true);
      expect(result.data.versions).toHaveLength(1);
    });

    it('should include backlinks when requested', async () => {
      const note = { id: 'note-1', title: 'Test' };
      mockNoteRepo.findById.mockResolvedValue(note);
      mockNoteRepo.getBacklinks.mockResolvedValue([
        { id: 'note-2', title: 'Linking Note' },
      ]);

      const handler = registeredHandlers.get('notes:get');
      const result = await handler({}, { id: 'note-1', include_backlinks: true });

      expect(result.success).toBe(true);
      expect(result.data.backlinks).toHaveLength(1);
    });

    it('should derive folderPath from notebook', async () => {
      const note = { id: 'note-1', title: 'Test', notebookId: 'nb-1' };
      mockNoteRepo.findById.mockResolvedValue(note);
      mockNotebookRepo.findById.mockResolvedValue({ id: 'nb-1', folderPath: 'Personal' });

      const handler = registeredHandlers.get('notes:get');
      const result = await handler({}, { id: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.folderPath).toBe('Personal');
    });

    it('should derive folderPath from filePath if no notebook', async () => {
      const note = { id: 'note-1', title: 'Test', filePath: 'Work/Projects/Note.md' };
      mockNoteRepo.findById.mockResolvedValue(note);

      const handler = registeredHandlers.get('notes:get');
      const result = await handler({}, { id: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.folderPath).toBe('Work/Projects');
    });
  });

  describe('notes:getByPath', () => {
    it('should return note by file path', async () => {
      const note = { id: 'note-1', title: 'Test', filePath: 'Personal/Note.md' };
      mockNoteRepo.findByFilePath.mockResolvedValue(note);

      const handler = registeredHandlers.get('notes:getByPath');
      const result = await handler({}, { filePath: 'Personal/Note.md' });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('note-1');
    });

    it('should return error if note not found', async () => {
      mockNoteRepo.findByFilePath.mockResolvedValue(null);

      const handler = registeredHandlers.get('notes:getByPath');
      const result = await handler({}, { filePath: 'nonexistent.md' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('notes:getContent', () => {
    it('should return note content', async () => {
      mockNoteRepo.getContentById.mockResolvedValue('<p>Hello World</p>');

      const handler = registeredHandlers.get('notes:getContent');
      const result = await handler({}, { id: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.content).toBe('<p>Hello World</p>');
    });

    it('should return error if content not found', async () => {
      mockNoteRepo.getContentById.mockResolvedValue(null);

      const handler = registeredHandlers.get('notes:getContent');
      const result = await handler({}, { id: 'note-1' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('notes:getAll', () => {
    it('should return all notes for active workspace', async () => {
      const notes = [
        { id: 'note-1', title: 'Note 1' },
        { id: 'note-2', title: 'Note 2' },
      ];
      mockNoteRepo.findAll.mockResolvedValue(notes);

      const handler = registeredHandlers.get('notes:getAll');
      const result = await handler({}, {});

      expect(result.success).toBe(true);
      expect(result.data.notes).toHaveLength(2);
      expect(result.data.total).toBe(2);
    });

    it('should filter by folder path', async () => {
      const notes = [{ id: 'note-1', title: 'Note 1' }];
      mockNoteRepo.findByFolder.mockResolvedValue(notes);

      const handler = registeredHandlers.get('notes:getAll');
      const result = await handler({}, { folderPath: 'Personal' });

      expect(mockNoteRepo.findByFolder).toHaveBeenCalledWith('Personal');
      expect(result.data.notes).toHaveLength(1);
    });

    it('should filter by notebook', async () => {
      const notes = [{ id: 'note-1', title: 'Note 1' }];
      mockNoteRepo.findByNotebook.mockResolvedValue(notes);

      const handler = registeredHandlers.get('notes:getAll');
      await handler({}, { notebookId: 'nb-1' });

      expect(mockNoteRepo.findByNotebook).toHaveBeenCalledWith('nb-1');
    });

    it('should filter by tag', async () => {
      const notes = [{ id: 'note-1', title: 'Note 1' }];
      mockNoteRepo.findByTags.mockResolvedValue(notes);

      const handler = registeredHandlers.get('notes:getAll');
      await handler({}, { tagId: 'tag-1' });

      expect(mockNoteRepo.findByTags).toHaveBeenCalledWith(['tag-1']);
    });

    it('should filter favorites', async () => {
      const notes = [{ id: 'note-1', title: 'Favorite Note', isFavorite: true }];
      mockNoteRepo.getFavorites.mockResolvedValue(notes);

      const handler = registeredHandlers.get('notes:getAll');
      await handler({}, { is_favorite: true });

      expect(mockNoteRepo.getFavorites).toHaveBeenCalled();
    });

    it('should filter pinned', async () => {
      const notes = [{ id: 'note-1', title: 'Pinned Note', isPinned: true }];
      mockNoteRepo.getPinned.mockResolvedValue(notes);

      const handler = registeredHandlers.get('notes:getAll');
      await handler({}, { is_pinned: true });

      expect(mockNoteRepo.getPinned).toHaveBeenCalled();
    });

    it('should filter deleted', async () => {
      const notes = [{ id: 'note-1', title: 'Deleted Note', isDeleted: true }];
      mockNoteRepo.getDeleted.mockResolvedValue(notes);

      const handler = registeredHandlers.get('notes:getAll');
      await handler({}, { is_deleted: true });

      expect(mockNoteRepo.getDeleted).toHaveBeenCalled();
    });

    it('should filter archived', async () => {
      const notes = [{ id: 'note-1', title: 'Archived Note', isArchived: true }];
      mockNoteRepo.getArchived.mockResolvedValue(notes);

      const handler = registeredHandlers.get('notes:getAll');
      await handler({}, { is_archived: true });

      expect(mockNoteRepo.getArchived).toHaveBeenCalled();
    });

    it('should apply sort and order', async () => {
      mockNoteRepo.findAll.mockResolvedValue([]);

      const handler = registeredHandlers.get('notes:getAll');
      await handler({}, { sort: 'created', order: 'asc' });

      expect(mockNoteRepo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        sort: { field: 'createdAt', order: 'ASC' },
      }));
    });

    it('should apply limit and offset', async () => {
      mockNoteRepo.findAll.mockResolvedValue([]);

      const handler = registeredHandlers.get('notes:getAll');
      await handler({}, { limit: 10, offset: 20 });

      expect(mockNoteRepo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        limit: 10,
        offset: 20,
      }));
    });

    it('should enrich notes with tags and attachments', async () => {
      const notes = [{ id: 'note-1', title: 'Test' }];
      mockNoteRepo.findAll.mockResolvedValue(notes);
      mockTagRepo.getTagsForNotes.mockResolvedValue(new Map([
        ['note-1', [{ id: 'tag-1', name: 'work' }]],
      ]));
      mockAttachmentRepo.getAttachmentsForNotes.mockResolvedValue(new Map([
        ['note-1', [{ id: 'att-1', filename: 'file.png' }]],
      ]));

      const handler = registeredHandlers.get('notes:getAll');
      const result = await handler({}, {});

      expect(result.success).toBe(true);
      expect(result.data.notes[0].tags).toHaveLength(1);
      expect(result.data.notes[0].attachments).toHaveLength(1);
    });
  });

  describe('notes:favorite', () => {
    it('should toggle favorite status', async () => {
      const note = { id: 'note-1', title: 'Test', isFavorite: true };
      mockNoteRepo.toggleFavorite.mockResolvedValue(note);

      const handler = registeredHandlers.get('notes:favorite');
      const result = await handler({}, { id: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.isFavorite).toBe(true);
      expect(mockNoteRepo.toggleFavorite).toHaveBeenCalledWith('note-1');
    });
  });

  describe('notes:pin', () => {
    it('should toggle pin status', async () => {
      const note = { id: 'note-1', title: 'Test', isPinned: true };
      mockNoteRepo.togglePin.mockResolvedValue(note);

      const handler = registeredHandlers.get('notes:pin');
      const result = await handler({}, { id: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.isPinned).toBe(true);
      expect(mockNoteRepo.togglePin).toHaveBeenCalledWith('note-1');
    });
  });

  describe('notes:archive', () => {
    it('should toggle archive status', async () => {
      const note = { id: 'note-1', title: 'Test', isArchived: true };
      mockNoteRepo.toggleArchive.mockResolvedValue(note);

      const handler = registeredHandlers.get('notes:archive');
      const result = await handler({}, { id: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.isArchived).toBe(true);
      expect(mockNoteRepo.toggleArchive).toHaveBeenCalledWith('note-1');
    });
  });

  describe('notes:getVersions', () => {
    it('should return version history', async () => {
      const versions = [
        { id: 'v-1', versionNumber: 1 },
        { id: 'v-2', versionNumber: 2 },
      ];
      mockVersionRepo.getVersionSummary.mockResolvedValue(versions);

      const handler = registeredHandlers.get('notes:getVersions');
      const result = await handler({}, { noteId: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.versions).toHaveLength(2);
      expect(result.data.total).toBe(2);
    });
  });

  describe('notes:restoreVersion', () => {
    it('should restore a version', async () => {
      const version = {
        id: 'v-1',
        versionNumber: 1,
        title: 'Old Title',
        content: 'Old content',
      };
      const currentNote = { id: 'note-1', title: 'Current' };
      const restoredNote = { id: 'note-1', title: 'Old Title' };

      mockVersionRepo.findById.mockResolvedValue(version);
      mockNoteRepo.findById.mockResolvedValue(currentNote);
      mockNoteRepo.getContentById.mockResolvedValue('Current content');
      mockNoteRepo.update.mockResolvedValue(restoredNote);

      const handler = registeredHandlers.get('notes:restoreVersion');
      const result = await handler({}, { noteId: 'note-1', versionId: 'v-1' });

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Old Title');
      expect(result.data.message).toBe('Version restored successfully');
    });

    it('should create backup version before restoring', async () => {
      const version = { id: 'v-1', versionNumber: 1, title: 'Old', content: 'Old' };
      const currentNote = { id: 'note-1', title: 'Current' };

      mockVersionRepo.findById.mockResolvedValue(version);
      mockNoteRepo.findById.mockResolvedValue(currentNote);
      mockNoteRepo.getContentById.mockResolvedValue('Current content');
      mockNoteRepo.update.mockResolvedValue(currentNote);

      const handler = registeredHandlers.get('notes:restoreVersion');
      await handler({}, { noteId: 'note-1', versionId: 'v-1' });

      expect(mockVersionRepo.createVersion).toHaveBeenCalledWith(
        'note-1',
        'Current',
        'Current content'
      );
    });

    it('should return error if version not found', async () => {
      mockVersionRepo.findById.mockResolvedValue(null);

      const handler = registeredHandlers.get('notes:restoreVersion');
      const result = await handler({}, { noteId: 'note-1', versionId: 'non-existent' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should broadcast version restored event', async () => {
      const mockWindow = { webContents: { send: vi.fn() } };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      const version = { id: 'v-1', versionNumber: 1, title: 'Old', content: 'Old' };
      const note = { id: 'note-1', title: 'Current' };

      mockVersionRepo.findById.mockResolvedValue(version);
      mockNoteRepo.findById.mockResolvedValue(note);
      mockNoteRepo.getContentById.mockResolvedValue('Current');
      mockNoteRepo.update.mockResolvedValue(note);

      const handler = registeredHandlers.get('notes:restoreVersion');
      await handler({}, { noteId: 'note-1', versionId: 'v-1' });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'notes:versionRestored',
        expect.objectContaining({ note: expect.any(Object), version })
      );
    });
  });

  describe('notes:getBacklinks', () => {
    it('should return backlinks for a note', async () => {
      const backlinks = [
        { id: 'note-2', title: 'Linking Note' },
      ];
      mockNoteRepo.getBacklinks.mockResolvedValue(backlinks);

      const handler = registeredHandlers.get('notes:getBacklinks');
      const result = await handler({}, { noteId: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.backlinks).toHaveLength(1);
    });
  });

  describe('notes:getForwardLinks', () => {
    it('should return forward links for a note', async () => {
      const forwardLinks = [
        { id: 'note-3', title: 'Linked Note' },
      ];
      mockNoteRepo.getForwardLinks.mockResolvedValue(forwardLinks);

      const handler = registeredHandlers.get('notes:getForwardLinks');
      const result = await handler({}, { noteId: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.forwardLinks).toHaveLength(1);
    });
  });

  describe('notes:getGraphData', () => {
    it('should return graph data', async () => {
      const graphData = {
        nodes: [{ id: 'note-1', label: 'Note 1' }],
        edges: [{ source: 'note-1', target: 'note-2' }],
      };
      mockNoteRepo.getGraphData.mockResolvedValue(graphData);

      const handler = registeredHandlers.get('notes:getGraphData');
      const result = await handler({}, {});

      expect(result.success).toBe(true);
      expect(result.data.nodes).toHaveLength(1);
      expect(result.data.edges).toHaveLength(1);
    });
  });

  describe('notes:move', () => {
    it('should move note to a new folder', async () => {
      const oldNote = { id: 'note-1', title: 'Test', filePath: 'Old/Note.md' };
      const movedNote = { id: 'note-1', title: 'Test', filePath: 'New/Note.md' };

      mockNoteRepo.findById.mockResolvedValue(oldNote);
      mockNoteRepo.getContentById.mockResolvedValue('Content');
      mockNoteRepo.update.mockResolvedValue(movedNote);

      const handler = registeredHandlers.get('notes:move');
      const result = await handler({}, { id: 'note-1', folderPath: 'New' });

      expect(result.success).toBe(true);
      expect(mockNoteRepo.update).toHaveBeenCalledWith('note-1', { folderPath: 'New' });
    });

    it('should return error if note not found', async () => {
      mockNoteRepo.findById.mockResolvedValue(null);

      const handler = registeredHandlers.get('notes:move');
      const result = await handler({}, { id: 'non-existent', folderPath: 'New' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should create version before moving', async () => {
      const oldNote = { id: 'note-1', title: 'Test' };
      mockNoteRepo.findById.mockResolvedValue(oldNote);
      mockNoteRepo.getContentById.mockResolvedValue('Content');
      mockNoteRepo.update.mockResolvedValue(oldNote);

      const handler = registeredHandlers.get('notes:move');
      await handler({}, { id: 'note-1', folderPath: 'New' });

      expect(mockVersionRepo.createVersion).toHaveBeenCalledWith('note-1', 'Test', 'Content');
    });
  });

  describe('notes:getAllTodos', () => {
    it('should return empty array when no notes', async () => {
      mockNoteRepo.findAll.mockResolvedValue([]);

      const handler = registeredHandlers.get('notes:getAllTodos');
      const result = await handler({}, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return empty array when notes have no content', async () => {
      mockNoteRepo.findAll.mockResolvedValue([{ id: 'note-1', title: 'Test' }]);
      mockNoteRepo.getContentById.mockResolvedValue(null);

      const handler = registeredHandlers.get('notes:getAllTodos');
      const result = await handler({}, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('notes:exportHtml', () => {
    it('should export note as HTML', async () => {
      const note = { id: 'note-1', title: 'Test' };
      mockNoteRepo.findById.mockResolvedValue(note);

      const handler = registeredHandlers.get('notes:exportHtml');
      const result = await handler({}, {
        id: 'note-1',
        content: '<p>Hello</p>',
        title: 'Test',
      });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should return error if note not found', async () => {
      mockNoteRepo.findById.mockResolvedValue(null);

      const handler = registeredHandlers.get('notes:exportHtml');
      const result = await handler({}, {
        id: 'non-existent',
        content: '<p>Hello</p>',
        title: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should return canceled if dialog is canceled', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'note-1' });
      (dialog.showSaveDialog as any).mockResolvedValue({ canceled: true });

      const handler = registeredHandlers.get('notes:exportHtml');
      const result = await handler({}, {
        id: 'note-1',
        content: '<p>Hello</p>',
        title: 'Test',
      });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(false);
      expect(result.data.canceled).toBe(true);
    });
  });

  describe('notes:exportMarkdown', () => {
    it('should export note as Markdown', async () => {
      const note = { id: 'note-1', title: 'Test' };
      mockNoteRepo.findById.mockResolvedValue(note);
      mockNoteRepo.getRawContentById.mockResolvedValue('# Test\n\nHello World');
      (dialog.showSaveDialog as any).mockResolvedValue({
        canceled: false,
        filePath: '/path/to/export.md',
      });

      const handler = registeredHandlers.get('notes:exportMarkdown');
      const result = await handler({}, { id: 'note-1', title: 'Test' });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/path/to/export.md',
        '# Test\n\nHello World',
        'utf-8'
      );
    });

    it('should return error if note not found', async () => {
      mockNoteRepo.findById.mockResolvedValue(null);

      const handler = registeredHandlers.get('notes:exportMarkdown');
      const result = await handler({}, { id: 'non-existent', title: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should return error if content not found', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'note-1' });
      mockNoteRepo.getRawContentById.mockResolvedValue(null);

      const handler = registeredHandlers.get('notes:exportMarkdown');
      const result = await handler({}, { id: 'note-1', title: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should return canceled if dialog is canceled', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'note-1' });
      mockNoteRepo.getRawContentById.mockResolvedValue('Content');
      (dialog.showSaveDialog as any).mockResolvedValue({ canceled: true });

      const handler = registeredHandlers.get('notes:exportMarkdown');
      const result = await handler({}, { id: 'note-1', title: 'Test' });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(false);
      expect(result.data.canceled).toBe(true);
    });
  });
});
