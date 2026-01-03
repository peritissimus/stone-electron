/**
 * Attachment IPC Handler Tests
 *
 * Tests IPC layer concerns: parameter mapping, error code mapping, response formatting.
 * Business logic is tested in AttachmentService.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron before importing handlers
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock AttachmentService
const mockAttachmentService = {
  addAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  getAttachmentsForNote: vi.fn(),
  uploadImage: vi.fn(),
};

vi.mock('../../../src/main/services/AttachmentService', () => ({
  getAttachmentService: vi.fn(() => mockAttachmentService),
}));

// Import after mocks
import { registerAttachmentHandlers } from '../../../src/main/ipc/handlers/attachmentHandlers';
import { ipcMain } from 'electron';

// Create mock container (handler still uses singleton, but signature requires container)
const mockContainer = {
  cradle: {},
} as any;

describe('Attachment IPC Handlers', () => {
  let registeredHandlers: Map<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers = new Map();

    (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    });

    registerAttachmentHandlers(mockContainer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('attachments:add', () => {
    it('should call service and return formatted response', async () => {
      const mockAttachment = {
        id: 'att-1',
        noteId: 'note-1',
        filename: 'test.png',
        path: 'attachments/note-1/test.png',
      };
      mockAttachmentService.addAttachment.mockResolvedValue(mockAttachment);

      const handler = registeredHandlers.get('attachments:add');
      const result = await handler(
        {},
        { noteId: 'note-1', file_path: '/path/to/test.png', filename: 'test.png' },
      );

      expect(result.success).toBe(true);
      expect(result.data.noteId).toBe('note-1');
      expect(mockAttachmentService.addAttachment).toHaveBeenCalledWith({
        noteId: 'note-1',
        filePath: '/path/to/test.png',
        filename: 'test.png',
      });
    });

    it('should map note not found error to NOT_FOUND code', async () => {
      mockAttachmentService.addAttachment.mockRejectedValue(new Error('Note not found'));

      const handler = registeredHandlers.get('attachments:add');
      const result = await handler({}, { noteId: 'bad', file_path: '/path/to/file.txt' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should map file not found error to FILE_ERROR code', async () => {
      mockAttachmentService.addAttachment.mockRejectedValue(new Error('File not found'));

      const handler = registeredHandlers.get('attachments:add');
      const result = await handler({}, { noteId: 'note-1', file_path: '/nonexistent.txt' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('FILE_ERROR');
    });

    it('should map path traversal error to INVALID_INPUT code', async () => {
      mockAttachmentService.addAttachment.mockRejectedValue(
        new Error('path traversal not allowed'),
      );

      const handler = registeredHandlers.get('attachments:add');
      const result = await handler(
        {},
        { noteId: 'note-1', file_path: '/path.txt', filename: '../../../etc/passwd' },
      );

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_INPUT');
    });
  });

  describe('attachments:delete', () => {
    it('should call service and return success', async () => {
      mockAttachmentService.deleteAttachment.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('attachments:delete');
      const result = await handler({}, { id: 'att-1', noteId: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(mockAttachmentService.deleteAttachment).toHaveBeenCalledWith('att-1');
    });

    it('should map not found error to NOT_FOUND code', async () => {
      mockAttachmentService.deleteAttachment.mockRejectedValue(new Error('Attachment not found'));

      const handler = registeredHandlers.get('attachments:delete');
      const result = await handler({}, { id: 'bad', noteId: 'note-1' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('attachments:getAll', () => {
    it('should call service and return attachments array', async () => {
      const mockAttachments = [
        { id: 'att-1', filename: 'file1.png' },
        { id: 'att-2', filename: 'file2.pdf' },
      ];
      mockAttachmentService.getAttachmentsForNote.mockResolvedValue(mockAttachments);

      const handler = registeredHandlers.get('attachments:getAll');
      const result = await handler({}, { noteId: 'note-1' });

      expect(result.success).toBe(true);
      expect(result.data.attachments).toEqual(mockAttachments);
      expect(mockAttachmentService.getAttachmentsForNote).toHaveBeenCalledWith('note-1');
    });
  });

  describe('attachments:uploadImage', () => {
    it('should call service and return upload result', async () => {
      const mockResult = {
        success: true,
        relativePath: '.assets/image-123.png',
        filename: 'image-123.png',
      };
      mockAttachmentService.uploadImage.mockResolvedValue(mockResult);

      const handler = registeredHandlers.get('attachments:uploadImage');
      const result = await handler(
        {},
        { noteId: 'note-1', imageData: 'base64data', mimeType: 'image/png' },
      );

      expect(result.success).toBe(true);
      expect(result.data.relativePath).toContain('.assets/');
      expect(mockAttachmentService.uploadImage).toHaveBeenCalledWith({
        noteId: 'note-1',
        imageData: 'base64data',
        mimeType: 'image/png',
        filename: undefined,
      });
    });

    it('should map note not found error to NOT_FOUND code', async () => {
      mockAttachmentService.uploadImage.mockRejectedValue(new Error('Note not found'));

      const handler = registeredHandlers.get('attachments:uploadImage');
      const result = await handler(
        {},
        { noteId: 'bad', imageData: 'data', mimeType: 'image/png' },
      );

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should map workspace not found error to NOT_FOUND code', async () => {
      mockAttachmentService.uploadImage.mockRejectedValue(new Error('Workspace not found'));

      const handler = registeredHandlers.get('attachments:uploadImage');
      const result = await handler(
        {},
        { noteId: 'note-1', imageData: 'data', mimeType: 'image/png' },
      );

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should map no workspace error to INVALID_INPUT code', async () => {
      mockAttachmentService.uploadImage.mockRejectedValue(new Error('Note has no workspace'));

      const handler = registeredHandlers.get('attachments:uploadImage');
      const result = await handler(
        {},
        { noteId: 'note-1', imageData: 'data', mimeType: 'image/png' },
      );

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_INPUT');
    });
  });
});
