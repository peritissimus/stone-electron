/**
 * Note IPC Handler Tests
 *
 * Tests IPC layer concerns: parameter mapping, error code mapping, response formatting,
 * enrichment, versioning, and export dialog handling.
 * Business logic is tested in NoteService.test.ts, GraphService.test.ts, etc.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron before importing handlers
vi.mock('electron', () => ({
  BrowserWindow: {
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
    showSaveDialog: vi.fn(() =>
      Promise.resolve({ canceled: false, filePath: '/path/to/export.html' }),
    ),
  },
  app: {
    getPath: vi.fn(() => '/tmp'),
  },
}));

// Mock EventBus
const mockEventBus = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock('../../../src/main/services/EventBus', () => ({
  getEventBus: vi.fn(() => mockEventBus),
}));

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(() => Promise.resolve()),
  unlink: vi.fn(() => Promise.resolve()),
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

// Mock NoteService
const mockNoteService = {
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  getContent: vi.fn(),
  moveNote: vi.fn(),
};

vi.mock('../../../src/main/services/NoteService', () => ({
  getNoteService: vi.fn(() => mockNoteService),
}));

// Mock GraphService
const mockGraphService = {
  getBacklinks: vi.fn(),
  getForwardLinks: vi.fn(),
  getGraphData: vi.fn(),
};

vi.mock('../../../src/main/services/GraphService', () => ({
  getGraphService: vi.fn(() => mockGraphService),
}));

// Mock TaskService
const mockTaskService = {
  getAllTodos: vi.fn(),
  updateTaskState: vi.fn(),
};

vi.mock('../../../src/main/services/TaskService', () => ({
  getTaskService: vi.fn(() => mockTaskService),
}));

// Mock ExportService
const mockExportService = {
  prepareHtmlExport: vi.fn(),
  getMarkdownForExport: vi.fn(),
};

vi.mock('../../../src/main/services/ExportService', () => ({
  getExportService: vi.fn(() => mockExportService),
}));

// Mock repositories (still needed for enriching notes)
const mockNoteRepo = {
  findById: vi.fn(),
  findAll: vi.fn(),
  findByTags: vi.fn(),
  findByFolder: vi.fn(),
  findByNotebook: vi.fn(),
  findByFilePath: vi.fn(),
  getContentById: vi.fn(),
  toggleFavorite: vi.fn(),
  togglePin: vi.fn(),
  toggleArchive: vi.fn(),
  getFavorites: vi.fn(),
  getPinned: vi.fn(),
  getDeleted: vi.fn(),
  getArchived: vi.fn(),
  update: vi.fn(),
};

const mockTagRepo = {
  getTagsForNote: vi.fn(),
  getTagsForNotes: vi.fn(),
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
import { ipcMain, dialog } from 'electron';
import * as fs from 'node:fs/promises';

describe('Note IPC Handlers', () => {
  let registeredHandlers: Map<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers = new Map();

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
    it('should call service and return formatted response', async () => {
      const mockNote = {
        id: 'note-1',
        title: 'Test Note',
        filePath: 'notes/Test Note.md',
        workspaceId: 'ws-1',
      };
      mockNoteService.createNote.mockResolvedValue(mockNote);

      const handler = registeredHandlers.get('notes:create');
      const result = await handler({}, { title: 'Test Note', content: '<p>Hello</p>' });

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Test Note');
      expect(mockNoteService.createNote).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Test Note', content: '<p>Hello</p>' }),
      );
    });
  });

  describe('notes:update', () => {
    it('should call service and return formatted response', async () => {
      const oldNote = { id: 'note-1', title: 'Old Title' };
      const updatedNote = { id: 'note-1', title: 'New Title' };

      mockNoteRepo.findById.mockResolvedValue(oldNote);
      mockNoteService.updateNote.mockResolvedValue(updatedNote);

      const handler = registeredHandlers.get('notes:update');
      const result = await handler({}, { id: 'note-1', title: 'New Title' });

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('New Title');
    });

    it('should map not found error to NOT_FOUND code', async () => {
      mockNoteRepo.findById.mockResolvedValue(null);

      const handler = registeredHandlers.get('notes:update');
      const result = await handler({}, { id: 'non-existent', title: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should create version when content changes', async () => {
      const oldNote = { id: 'note-1', title: 'Test' };
      mockNoteRepo.findById.mockResolvedValue(oldNote);
      mockNoteService.getContent.mockResolvedValue('Old content');
      mockNoteService.updateNote.mockResolvedValue(oldNote);

      const handler = registeredHandlers.get('notes:update');
      await handler({}, { id: 'note-1', content: 'New content' });

      expect(mockVersionRepo.createVersion).toHaveBeenCalledWith('note-1', 'Test', 'Old content');
    });
  });

  describe('notes:delete', () => {
    it('should call service with permanent flag', async () => {
      mockNoteService.deleteNote.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('notes:delete');
      const result = await handler({}, { id: 'note-1', permanent: true });

      expect(result.success).toBe(true);
      expect(mockNoteService.deleteNote).toHaveBeenCalledWith('note-1', true);
    });

    it('should map not found error to NOT_FOUND code', async () => {
      mockNoteService.deleteNote.mockRejectedValue(new Error('Note not found'));

      const handler = registeredHandlers.get('notes:delete');
      const result = await handler({}, { id: 'bad', permanent: true });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('notes:get', () => {
    it('should enrich note with tags and attachments', async () => {
      const note = { id: 'note-1', title: 'Test', notebookId: null };
      mockNoteRepo.findById.mockResolvedValue(note);
      mockTagRepo.getTagsForNote.mockResolvedValue([{ id: 'tag-1', name: 'work' }]);
      mockAttachmentRepo.getAttachmentsForNote.mockResolvedValue([{ id: 'att-1' }]);

      const handler = registeredHandlers.get('notes:get');
      const result = await handler({}, { id: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.tags).toHaveLength(1);
      expect(result.data.attachments).toHaveLength(1);
    });

    it('should map not found error to NOT_FOUND code', async () => {
      mockNoteRepo.findById.mockResolvedValue(null);

      const handler = registeredHandlers.get('notes:get');
      const result = await handler({}, { id: 'non-existent' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should include backlinks when requested', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'note-1', title: 'Test' });
      mockGraphService.getBacklinks.mockResolvedValue([{ id: 'note-2', title: 'Linking' }]);

      const handler = registeredHandlers.get('notes:get');
      const result = await handler({}, { id: 'note-1', include_backlinks: true });

      expect(result.data.backlinks).toHaveLength(1);
    });
  });

  describe('notes:getContent', () => {
    it('should return content from service', async () => {
      mockNoteService.getContent.mockResolvedValue('<p>Hello World</p>');

      const handler = registeredHandlers.get('notes:getContent');
      const result = await handler({}, { id: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.content).toBe('<p>Hello World</p>');
    });

    it('should map not found when content is null', async () => {
      mockNoteService.getContent.mockResolvedValue(null);

      const handler = registeredHandlers.get('notes:getContent');
      const result = await handler({}, { id: 'note-1' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('notes:getAll', () => {
    it('should enrich notes with tags and attachments', async () => {
      mockNoteRepo.findAll.mockResolvedValue([{ id: 'note-1', title: 'Test' }]);
      mockTagRepo.getTagsForNotes.mockResolvedValue(
        new Map([['note-1', [{ id: 'tag-1', name: 'work' }]]]),
      );
      mockAttachmentRepo.getAttachmentsForNotes.mockResolvedValue(
        new Map([['note-1', [{ id: 'att-1' }]]]),
      );

      const handler = registeredHandlers.get('notes:getAll');
      const result = await handler({}, {});

      expect(result.success).toBe(true);
      expect(result.data.notes[0].tags).toHaveLength(1);
      expect(result.data.notes[0].attachments).toHaveLength(1);
    });

    it('should pass filter parameters to repository', async () => {
      mockNoteRepo.findByFolder.mockResolvedValue([]);

      const handler = registeredHandlers.get('notes:getAll');
      await handler({}, { folderPath: 'Personal', limit: 10, offset: 5 });

      expect(mockNoteRepo.findByFolder).toHaveBeenCalledWith('Personal');
    });
  });

  describe('notes:favorite/pin/archive', () => {
    it('should toggle favorite status', async () => {
      mockNoteRepo.toggleFavorite.mockResolvedValue({ id: 'note-1', isFavorite: true });

      const handler = registeredHandlers.get('notes:favorite');
      const result = await handler({}, { id: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.isFavorite).toBe(true);
    });

    it('should toggle pin status', async () => {
      mockNoteRepo.togglePin.mockResolvedValue({ id: 'note-1', isPinned: true });

      const handler = registeredHandlers.get('notes:pin');
      const result = await handler({}, { id: 'note-1' });

      expect(result.data.isPinned).toBe(true);
    });
  });

  describe('notes:move', () => {
    it('should call service and create version before moving', async () => {
      const note = { id: 'note-1', title: 'Test' };
      mockNoteRepo.findById.mockResolvedValue(note);
      mockNoteService.getContent.mockResolvedValue('Content');
      mockNoteService.moveNote.mockResolvedValue({ ...note, filePath: 'New/Test.md' });

      const handler = registeredHandlers.get('notes:move');
      const result = await handler({}, { id: 'note-1', folderPath: 'New' });

      expect(result.success).toBe(true);
      expect(mockVersionRepo.createVersion).toHaveBeenCalledWith('note-1', 'Test', 'Content');
      expect(mockNoteService.moveNote).toHaveBeenCalledWith('note-1', 'New');
    });
  });

  describe('notes:restoreVersion', () => {
    it('should create backup and restore version', async () => {
      const version = { id: 'v-1', versionNumber: 1, title: 'Old', content: 'Old content' };
      const note = { id: 'note-1', title: 'Current' };

      mockVersionRepo.findById.mockResolvedValue(version);
      mockNoteRepo.findById.mockResolvedValue(note);
      mockNoteRepo.getContentById.mockResolvedValue('Current content');
      mockNoteRepo.update.mockResolvedValue(note);

      const handler = registeredHandlers.get('notes:restoreVersion');
      const result = await handler({}, { noteId: 'note-1', versionId: 'v-1' });

      expect(result.success).toBe(true);
      expect(mockVersionRepo.createVersion).toHaveBeenCalledWith('note-1', 'Current', 'Current content');
    });

    it('should map not found when version missing', async () => {
      mockVersionRepo.findById.mockResolvedValue(null);

      const handler = registeredHandlers.get('notes:restoreVersion');
      const result = await handler({}, { noteId: 'note-1', versionId: 'bad' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('notes:getBacklinks/getForwardLinks', () => {
    it('should return backlinks from GraphService', async () => {
      mockGraphService.getBacklinks.mockResolvedValue([{ id: 'note-2' }]);

      const handler = registeredHandlers.get('notes:getBacklinks');
      const result = await handler({}, { noteId: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.backlinks).toHaveLength(1);
    });

    it('should return forward links from GraphService', async () => {
      mockGraphService.getForwardLinks.mockResolvedValue([{ id: 'note-3' }]);

      const handler = registeredHandlers.get('notes:getForwardLinks');
      const result = await handler({}, { noteId: 'note-1' });

      expect(result.data.forwardLinks).toHaveLength(1);
    });
  });

  describe('notes:getAllTodos', () => {
    it('should return todos from TaskService', async () => {
      const todos = [{ noteId: 'note-1', tasks: [{ text: 'Task 1', state: 'TODO' }] }];
      mockTaskService.getAllTodos.mockResolvedValue(todos);

      const handler = registeredHandlers.get('notes:getAllTodos');
      const result = await handler({}, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual(todos);
    });
  });

  describe('notes:exportHtml', () => {
    it('should export note as HTML via dialog', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'note-1', title: 'Test' });
      mockExportService.prepareHtmlExport.mockResolvedValue('<html>...</html>');

      const handler = registeredHandlers.get('notes:exportHtml');
      const result = await handler({}, { id: 'note-1', content: '<p>Hi</p>', title: 'Test' });

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should handle dialog cancellation', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'note-1' });
      (dialog.showSaveDialog as any).mockResolvedValue({ canceled: true });

      const handler = registeredHandlers.get('notes:exportHtml');
      const result = await handler({}, { id: 'note-1', content: '<p>Hi</p>', title: 'Test' });

      expect(result.data.canceled).toBe(true);
    });
  });

  describe('notes:exportMarkdown', () => {
    it('should export note as Markdown via dialog', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'note-1' });
      mockExportService.getMarkdownForExport.mockResolvedValue('# Test\n\nContent');
      (dialog.showSaveDialog as any).mockResolvedValue({
        canceled: false,
        filePath: '/path/to/export.md',
      });

      const handler = registeredHandlers.get('notes:exportMarkdown');
      const result = await handler({}, { id: 'note-1', title: 'Test' });

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith('/path/to/export.md', '# Test\n\nContent', 'utf-8');
    });

    it('should map not found when note missing', async () => {
      mockNoteRepo.findById.mockResolvedValue(null);

      const handler = registeredHandlers.get('notes:exportMarkdown');
      const result = await handler({}, { id: 'bad', title: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });
});
