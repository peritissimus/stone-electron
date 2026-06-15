/**
 * NoteIPC Adapter Tests
 *
 * Tests the IPC adapter that handles note-related electron IPC calls.
 * Mocks ipcMain and use cases to test handler registration and responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerNoteHandlers,
  unregisterNoteHandlers,
} from '../../../../../src/main/adapters/in/ipc/NoteIPC';
import type { INoteUseCases } from '../../../../../src/main/domain/ports/in/INoteUseCases';
import type { NoteProps } from '../../../../../src/main/domain/entities/Note';

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
}));

// Import after mock
import { ipcMain } from 'electron';

// Mock logger
vi.mock('../../../../../src/main/shared', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

function createMockNoteUseCases(): INoteUseCases {
  return {
    createNote: { execute: vi.fn() },
    getNote: { execute: vi.fn() },
    getNoteContent: { execute: vi.fn() },
    updateNote: { execute: vi.fn() },
    deleteNote: { execute: vi.fn() },
    listNotes: { execute: vi.fn() },
    moveNote: { execute: vi.fn() },
    getNoteByPath: { execute: vi.fn() },
    toggleFavorite: { execute: vi.fn() },
    togglePin: { execute: vi.fn() },
    toggleArchive: { execute: vi.fn() },
    saveNoteContent: { execute: vi.fn() },
    restoreNote: { execute: vi.fn() },
    duplicateNote: { execute: vi.fn() },
  } as unknown as INoteUseCases;
}

function createNoteProps(overrides: Partial<NoteProps> = {}): NoteProps {
  return {
    id: 'note-1',
    title: 'Test Note',
    filePath: 'test.md',
    notebookId: null,
    workspaceId: 'ws-1',
    isFavorite: false,
    isPinned: false,
    isArchived: false,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    ...overrides,
  };
}

describe('NoteIPC', () => {
  let noteUseCases: INoteUseCases;
  let handlers: Map<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = new Map();

    // Capture registered handlers
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: Function) => {
      handlers.set(channel, handler);
    });

    noteUseCases = createMockNoteUseCases();
  });

  afterEach(() => {
    unregisterNoteHandlers();
  });

  describe('registerHandlers', () => {
    it('registers all note handlers', () => {
      registerNoteHandlers({ noteUseCases });

      expect(ipcMain.handle).toHaveBeenCalledWith('notes:create', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('notes:get', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('notes:getContent', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('notes:update', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('notes:delete', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('notes:getAll', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('notes:move', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('notes:getByPath', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('notes:favorite', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('notes:pin', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('notes:archive', expect.any(Function));
    });
  });

  describe('unregisterHandlers', () => {
    it('removes all note handlers', () => {
      registerNoteHandlers({ noteUseCases });
      unregisterNoteHandlers();

      expect(ipcMain.removeHandler).toHaveBeenCalledWith('notes:create');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('notes:get');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('notes:getContent');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('notes:update');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('notes:delete');
    });
  });

  describe('notes:create handler', () => {
    it('returns success with note data', async () => {
      const note = createNoteProps();
      vi.mocked(noteUseCases.createNote.execute).mockResolvedValue({ note });
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:create')!;
      const result = await handler({}, { title: 'Test', workspaceId: 'ws-1' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(note);
      expect(noteUseCases.createNote.execute).toHaveBeenCalledWith({
        title: 'Test',
        workspaceId: 'ws-1',
      });
    });

    it('returns error on failure', async () => {
      vi.mocked(noteUseCases.createNote.execute).mockRejectedValue(new Error('Creation failed'));
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:create')!;
      const result = await handler({}, { title: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error.message).toBe('Creation failed');
      expect(result.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('notes:get handler', () => {
    it('returns note by id', async () => {
      const note = createNoteProps();
      vi.mocked(noteUseCases.getNote.execute).mockResolvedValue({ note, content: undefined });
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:get')!;
      const result = await handler({}, { id: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(note);
      expect(noteUseCases.getNote.execute).toHaveBeenCalledWith({
        id: 'note-1',
        includeContent: true,
      });
    });

    it('returns error for NoteNotFoundError', async () => {
      const error = new Error('Note not found');
      error.name = 'NoteNotFoundError';
      vi.mocked(noteUseCases.getNote.execute).mockRejectedValue(error);
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:get')!;
      const result = await handler({}, { id: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOTE_NOT_FOUND');
    });
  });

  describe('notes:getContent handler', () => {
    it('returns note content', async () => {
      vi.mocked(noteUseCases.getNoteContent.execute).mockResolvedValue({
        content: '<h1>Hello</h1>',
      });
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:getContent')!;
      const result = await handler({}, { id: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ content: '<h1>Hello</h1>' });
    });
  });

  describe('notes:update handler', () => {
    it('updates note without content', async () => {
      const note = createNoteProps({ title: 'Updated Title' });
      vi.mocked(noteUseCases.updateNote.execute).mockResolvedValue({ note });
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:update')!;
      const result = await handler({}, { id: 'note-1', title: 'Updated Title' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(note);
      expect(noteUseCases.saveNoteContent.execute).not.toHaveBeenCalled();
    });

    it('saves content when provided', async () => {
      const note = createNoteProps();
      vi.mocked(noteUseCases.updateNote.execute).mockResolvedValue({ note });
      vi.mocked(noteUseCases.saveNoteContent.execute).mockResolvedValue(undefined);
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:update')!;
      await handler({}, { id: 'note-1', content: '# New content' });

      expect(noteUseCases.saveNoteContent.execute).toHaveBeenCalledWith({
        id: 'note-1',
        content: '# New content',
      });
    });
  });

  describe('notes:delete handler', () => {
    it('soft deletes note by default', async () => {
      vi.mocked(noteUseCases.deleteNote.execute).mockResolvedValue(undefined);
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:delete')!;
      const result = await handler({}, { id: 'note-1' });

      expect(result.success).toBe(true);
      expect(noteUseCases.deleteNote.execute).toHaveBeenCalledWith({
        id: 'note-1',
        permanent: undefined,
      });
    });

    it('permanently deletes when specified', async () => {
      vi.mocked(noteUseCases.deleteNote.execute).mockResolvedValue(undefined);
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:delete')!;
      await handler({}, { id: 'note-1', permanent: true });

      expect(noteUseCases.deleteNote.execute).toHaveBeenCalledWith({
        id: 'note-1',
        permanent: true,
      });
    });
  });

  describe('notes:getAll handler', () => {
    it('returns list of notes', async () => {
      const notes = [createNoteProps({ id: 'note-1' }), createNoteProps({ id: 'note-2' })];
      vi.mocked(noteUseCases.listNotes.execute).mockResolvedValue({ notes, total: 2 });
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:getAll')!;
      const result = await handler({}, { workspaceId: 'ws-1' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ notes, total: 2 });
    });

    it('handles empty request', async () => {
      vi.mocked(noteUseCases.listNotes.execute).mockResolvedValue({ notes: [], total: 0 });
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:getAll')!;
      await handler({}, null);

      expect(noteUseCases.listNotes.execute).toHaveBeenCalledWith({});
    });
  });

  describe('notes:favorite handler', () => {
    it('toggles favorite status', async () => {
      const note = createNoteProps({ isFavorite: true });
      vi.mocked(noteUseCases.toggleFavorite.execute).mockResolvedValue({ note });
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:favorite')!;
      const result = await handler({}, { id: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.isFavorite).toBe(true);
    });
  });

  describe('notes:pin handler', () => {
    it('toggles pin status', async () => {
      const note = createNoteProps({ isPinned: true });
      vi.mocked(noteUseCases.togglePin.execute).mockResolvedValue({ note });
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:pin')!;
      const result = await handler({}, { id: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.isPinned).toBe(true);
    });
  });

  describe('notes:archive handler', () => {
    it('toggles archive status', async () => {
      const note = createNoteProps({ isArchived: true });
      vi.mocked(noteUseCases.toggleArchive.execute).mockResolvedValue({ note });
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:archive')!;
      const result = await handler({}, { id: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.isArchived).toBe(true);
    });
  });

  describe('notes:move handler', () => {
    it('moves note to notebook', async () => {
      const note = createNoteProps({ notebookId: 'nb-2' });
      vi.mocked(noteUseCases.moveNote.execute).mockResolvedValue(undefined);
      vi.mocked(noteUseCases.getNote.execute).mockResolvedValue({ note, content: undefined });
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:move')!;
      const result = await handler({}, { id: 'note-1', targetNotebookId: 'nb-2' });

      expect(result.success).toBe(true);
      expect(noteUseCases.moveNote.execute).toHaveBeenCalledWith({
        id: 'note-1',
        targetNotebookId: 'nb-2',
      });
    });

    it('uses targetPath as fallback for targetNotebookId', async () => {
      const note = createNoteProps();
      vi.mocked(noteUseCases.moveNote.execute).mockResolvedValue(undefined);
      vi.mocked(noteUseCases.getNote.execute).mockResolvedValue({ note, content: undefined });
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:move')!;
      await handler({}, { id: 'note-1', targetPath: 'nb-3' });

      expect(noteUseCases.moveNote.execute).toHaveBeenCalledWith({
        id: 'note-1',
        targetNotebookId: 'nb-3',
      });
    });
  });

  describe('notes:getByPath handler', () => {
    it('finds note by file path', async () => {
      const note = createNoteProps();
      vi.mocked(noteUseCases.getNoteByPath.execute).mockResolvedValue({ note });
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:getByPath')!;
      const result = await handler({}, { filePath: 'notes/test.md' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(note);
      expect(noteUseCases.getNoteByPath.execute).toHaveBeenCalledWith({
        filePath: 'notes/test.md',
      });
    });

    it('uses path as fallback for filePath', async () => {
      const note = createNoteProps();
      vi.mocked(noteUseCases.getNoteByPath.execute).mockResolvedValue({ note });
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:getByPath')!;
      await handler({}, { path: 'notes/test.md' });

      expect(noteUseCases.getNoteByPath.execute).toHaveBeenCalledWith({
        filePath: 'notes/test.md',
      });
    });
  });

  describe('error handling', () => {
    it('handles NoteValidationError', async () => {
      const error = new Error('Invalid note');
      error.name = 'NoteValidationError';
      vi.mocked(noteUseCases.createNote.execute).mockRejectedValue(error);
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:create')!;
      const result = await handler({}, {});

      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('handles NoteNotEditableError', async () => {
      const error = new Error('Note is deleted');
      error.name = 'NoteNotEditableError';
      vi.mocked(noteUseCases.updateNote.execute).mockRejectedValue(error);
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:update')!;
      const result = await handler({}, { id: 'note-1' });

      expect(result.error.code).toBe('NOTE_NOT_EDITABLE');
    });

    it('handles unknown errors', async () => {
      vi.mocked(noteUseCases.createNote.execute).mockRejectedValue('string error');
      registerNoteHandlers({ noteUseCases });

      const handler = handlers.get('notes:create')!;
      const result = await handler({}, {});

      expect(result.error.code).toBe('UNKNOWN_ERROR');
      expect(result.error.message).toBe('Unknown error');
    });
  });
});
