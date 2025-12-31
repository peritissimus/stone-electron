/**
 * Attachment IPC Handler Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

// Mock electron before importing handlers
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [
      { webContents: { send: vi.fn() } },
    ]),
  },
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    statSync: vi.fn(),
    mkdirSync: vi.fn(),
    copyFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  statSync: vi.fn(),
  mkdirSync: vi.fn(),
  copyFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock repositories
const mockNoteRepo = {
  findById: vi.fn(),
};

const mockAttachmentRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  delete: vi.fn(),
  getAttachmentsForNote: vi.fn(),
};

const mockWorkspaceRepo = {
  findById: vi.fn(),
};

vi.mock('../../../src/main/repositories', () => ({
  getRepositories: vi.fn(() => ({
    note: mockNoteRepo,
    attachment: mockAttachmentRepo,
    workspace: mockWorkspaceRepo,
  })),
}));

// Mock database manager
vi.mock('../../../src/main/database', () => ({
  getDatabaseManager: vi.fn(() => ({
    getDataPath: vi.fn(() => '/mock/data/path'),
  })),
}));

// Mock markdown service
vi.mock('../../../src/main/services/MarkdownService', () => ({
  getMarkdownService: vi.fn(() => ({
    sanitizeFilename: vi.fn((name: string) => name.replace(/[^a-zA-Z0-9.-]/g, '_')),
  })),
}));

// Import after mocks
import { registerAttachmentHandlers } from '../../../src/main/ipc/handlers/attachmentHandlers';
import { ipcMain, BrowserWindow } from 'electron';
import fs from 'fs';

describe('Attachment IPC Handlers', () => {
  let registeredHandlers: Map<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers = new Map();

    // Capture registered handlers
    (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    });

    registerAttachmentHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('attachments:add', () => {
    it('should add an attachment to a note', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'note-1', title: 'Test Note' });
      (fs.existsSync as any).mockReturnValue(true);
      (fs.statSync as any).mockReturnValue({ size: 1024 });
      mockAttachmentRepo.create.mockResolvedValue({
        id: 'att-1',
        noteId: 'note-1',
        filename: 'test.png',
        path: 'attachments/note-1/test.png',
        mimeType: 'image/png',
        size: 1024,
      });

      const handler = registeredHandlers.get('attachments:add');
      const result = await handler({}, {
        noteId: 'note-1',
        file_path: '/path/to/test.png',
        filename: 'test.png',
      });

      expect(result.success).toBe(true);
      expect(result.data.noteId).toBe('note-1');
      expect(result.data.filename).toBe('test.png');
    });

    it('should return error if note not found', async () => {
      mockNoteRepo.findById.mockResolvedValue(null);

      const handler = registeredHandlers.get('attachments:add');
      const result = await handler({}, {
        noteId: 'non-existent',
        file_path: '/path/to/file.txt',
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should return error if file not found', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'note-1' });
      (fs.existsSync as any).mockReturnValue(false);

      const handler = registeredHandlers.get('attachments:add');
      const result = await handler({}, {
        noteId: 'note-1',
        file_path: '/nonexistent/file.txt',
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('FILE_ERROR');
    });

    it('should determine correct mime type', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'note-1' });
      (fs.existsSync as any).mockReturnValue(true);
      (fs.statSync as any).mockReturnValue({ size: 2048 });
      mockAttachmentRepo.create.mockImplementation(async (data) => data);

      const handler = registeredHandlers.get('attachments:add');
      await handler({}, {
        noteId: 'note-1',
        file_path: '/path/to/document.pdf',
      });

      expect(mockAttachmentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mimeType: 'application/pdf',
        })
      );
    });

    it('should broadcast attachment added event', async () => {
      const mockWindow = { webContents: { send: vi.fn() } };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      mockNoteRepo.findById.mockResolvedValue({ id: 'note-1' });
      (fs.existsSync as any).mockReturnValue(true);
      (fs.statSync as any).mockReturnValue({ size: 1024 });
      mockAttachmentRepo.create.mockResolvedValue({ id: 'att-1' });

      const handler = registeredHandlers.get('attachments:add');
      await handler({}, {
        noteId: 'note-1',
        file_path: '/path/to/file.txt',
      });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'attachments:added',
        expect.objectContaining({ attachment: expect.any(Object) })
      );
    });
  });

  describe('attachments:delete', () => {
    it('should delete an attachment', async () => {
      mockAttachmentRepo.findById.mockResolvedValue({
        id: 'att-1',
        path: 'attachments/note-1/test.png',
      });
      (fs.existsSync as any).mockReturnValue(true);
      mockAttachmentRepo.delete.mockResolvedValue(true);

      const handler = registeredHandlers.get('attachments:delete');
      const result = await handler({}, { id: 'att-1', noteId: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(mockAttachmentRepo.delete).toHaveBeenCalledWith('att-1');
    });

    it('should return error if attachment not found', async () => {
      mockAttachmentRepo.findById.mockResolvedValue(null);

      const handler = registeredHandlers.get('attachments:delete');
      const result = await handler({}, { id: 'non-existent', noteId: 'note-1' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should broadcast attachment deleted event', async () => {
      const mockWindow = { webContents: { send: vi.fn() } };
      (BrowserWindow.getAllWindows as any).mockReturnValue([mockWindow]);

      mockAttachmentRepo.findById.mockResolvedValue({
        id: 'att-1',
        path: 'attachments/note-1/test.png',
      });
      (fs.existsSync as any).mockReturnValue(false);
      mockAttachmentRepo.delete.mockResolvedValue(true);

      const handler = registeredHandlers.get('attachments:delete');
      await handler({}, { id: 'att-1', noteId: 'note-1' });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'attachments:deleted',
        { id: 'att-1' }
      );
    });
  });

  describe('attachments:getAll', () => {
    it('should return all attachments for a note', async () => {
      const mockAttachments = [
        { id: 'att-1', filename: 'file1.png' },
        { id: 'att-2', filename: 'file2.pdf' },
      ];
      mockAttachmentRepo.getAttachmentsForNote.mockResolvedValue(mockAttachments);

      const handler = registeredHandlers.get('attachments:getAll');
      const result = await handler({}, { noteId: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.attachments.length).toBe(2);
      expect(mockAttachmentRepo.getAttachmentsForNote).toHaveBeenCalledWith('note-1');
    });

    it('should return empty array for note without attachments', async () => {
      mockAttachmentRepo.getAttachmentsForNote.mockResolvedValue([]);

      const handler = registeredHandlers.get('attachments:getAll');
      const result = await handler({}, { noteId: 'note-1' });

      expect(result.data.attachments).toEqual([]);
    });
  });

  describe('attachments:uploadImage', () => {
    it('should upload an image from base64 data', async () => {
      mockNoteRepo.findById.mockResolvedValue({
        id: 'note-1',
        workspaceId: 'ws-1',
      });
      mockWorkspaceRepo.findById.mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace/path',
      });
      (fs.existsSync as any).mockReturnValue(true);

      const handler = registeredHandlers.get('attachments:uploadImage');
      const result = await handler({}, {
        noteId: 'note-1',
        imageData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        mimeType: 'image/png',
      });

      expect(result.success).toBe(true);
      expect(result.data.relativePath).toMatch(/^\.assets\/image-/);
      expect(result.data.filename).toMatch(/\.png$/);
    });

    it('should return error if note not found', async () => {
      mockNoteRepo.findById.mockResolvedValue(null);

      const handler = registeredHandlers.get('attachments:uploadImage');
      const result = await handler({}, {
        noteId: 'non-existent',
        imageData: 'base64data',
        mimeType: 'image/png',
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should return error if note has no workspace', async () => {
      mockNoteRepo.findById.mockResolvedValue({
        id: 'note-1',
        workspaceId: null,
      });

      const handler = registeredHandlers.get('attachments:uploadImage');
      const result = await handler({}, {
        noteId: 'note-1',
        imageData: 'base64data',
        mimeType: 'image/png',
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_INPUT');
    });

    it('should return error if workspace not found', async () => {
      mockNoteRepo.findById.mockResolvedValue({
        id: 'note-1',
        workspaceId: 'ws-1',
      });
      mockWorkspaceRepo.findById.mockResolvedValue(null);

      const handler = registeredHandlers.get('attachments:uploadImage');
      const result = await handler({}, {
        noteId: 'note-1',
        imageData: 'base64data',
        mimeType: 'image/png',
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should use correct extension for different mime types', async () => {
      mockNoteRepo.findById.mockResolvedValue({
        id: 'note-1',
        workspaceId: 'ws-1',
      });
      mockWorkspaceRepo.findById.mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace/path',
      });
      (fs.existsSync as any).mockReturnValue(true);

      const handler = registeredHandlers.get('attachments:uploadImage');
      const result = await handler({}, {
        noteId: 'note-1',
        imageData: 'base64data',
        mimeType: 'image/jpeg',
      });

      expect(result.data.filename).toMatch(/\.jpg$/);
    });
  });
});
