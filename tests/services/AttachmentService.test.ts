/**
 * AttachmentService Tests
 *
 * Unit tests for attachment management service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

// Mock fs module - use vi.hoisted to define mocks that are hoisted with vi.mock
const { mockFs } = vi.hoisted(() => ({
  mockFs: {
    existsSync: vi.fn(),
    statSync: vi.fn(),
    mkdirSync: vi.fn(),
    copyFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
}));

vi.mock('node:fs', () => ({
  default: mockFs,
  ...mockFs,
}));

// Mock repositories
const mockAttachmentRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  delete: vi.fn(),
  getAttachmentsForNote: vi.fn(),
};

const mockNoteRepo = {
  findById: vi.fn(),
};

const mockWorkspaceRepo = {
  findById: vi.fn(),
};

vi.mock('../../src/main/repositories', () => ({
  getRepositories: vi.fn(() => ({
    attachment: mockAttachmentRepo,
    note: mockNoteRepo,
    workspace: mockWorkspaceRepo,
  })),
}));

// Mock MarkdownService
const mockMarkdownService = {
  sanitizeFilename: vi.fn((filename: string) => filename.replace(/[^a-zA-Z0-9.-]/g, '_')),
};

vi.mock('../../src/main/services/MarkdownService', () => ({
  getMarkdownService: vi.fn(() => mockMarkdownService),
}));

// Mock DatabaseManager
const mockDbManager = {
  getDataPath: vi.fn(() => '/data'),
};

vi.mock('../../src/main/database', () => ({
  getDatabaseManager: vi.fn(() => mockDbManager),
}));

// Mock EventBus
const mockEventBus = {
  emit: vi.fn(),
};

vi.mock('../../src/main/services/EventBus', () => ({
  getEventBus: vi.fn(() => mockEventBus),
}));

// Import after mocks
import { getAttachmentService } from '../../src/main/services/AttachmentService';

describe('AttachmentService', () => {
  let attachmentService: ReturnType<typeof getAttachmentService>;

  beforeEach(() => {
    vi.clearAllMocks();
    attachmentService = getAttachmentService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('addAttachment', () => {
    it('should add an attachment from a file', async () => {
      const mockNote = { id: 'note-1', title: 'Test Note' };
      const mockAttachment = {
        id: 'att-1',
        noteId: 'note-1',
        filename: 'test.pdf',
        path: 'attachments/note-1/test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
      };

      mockNoteRepo.findById.mockResolvedValue(mockNote);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 });
      mockAttachmentRepo.create.mockResolvedValue(mockAttachment);

      const result = await attachmentService.addAttachment({
        noteId: 'note-1',
        filePath: '/source/test.pdf',
      });

      expect(result.filename).toBe('test.pdf');
      expect(mockAttachmentRepo.create).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith('attachments:added', { attachment: mockAttachment });
    });

    it('should throw error if note not found', async () => {
      mockNoteRepo.findById.mockResolvedValue(null);

      await expect(
        attachmentService.addAttachment({ noteId: 'non-existent', filePath: '/test.pdf' }),
      ).rejects.toThrow('Note not found');
    });

    it('should throw error if file not found', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'note-1' });
      mockFs.existsSync.mockReturnValue(false);

      await expect(
        attachmentService.addAttachment({ noteId: 'note-1', filePath: '/nonexistent.pdf' }),
      ).rejects.toThrow('File not found');
    });

    it('should use custom filename if provided', async () => {
      const mockNote = { id: 'note-1' };
      const mockAttachment = {
        id: 'att-1',
        noteId: 'note-1',
        filename: 'custom_name.pdf',
        path: 'attachments/note-1/custom_name.pdf',
        mimeType: 'application/pdf',
        size: 512,
      };

      mockNoteRepo.findById.mockResolvedValue(mockNote);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 512 });
      mockAttachmentRepo.create.mockResolvedValue(mockAttachment);
      mockMarkdownService.sanitizeFilename.mockReturnValue('custom_name.pdf');

      const result = await attachmentService.addAttachment({
        noteId: 'note-1',
        filePath: '/source/original.pdf',
        filename: 'custom name.pdf',
      });

      expect(mockMarkdownService.sanitizeFilename).toHaveBeenCalled();
    });
  });

  describe('deleteAttachment', () => {
    it('should delete an attachment', async () => {
      const mockAttachment = {
        id: 'att-1',
        path: 'attachments/note-1/test.pdf',
      };

      mockAttachmentRepo.findById.mockResolvedValue(mockAttachment);
      mockFs.existsSync.mockReturnValue(true);

      await attachmentService.deleteAttachment('att-1');

      expect(mockAttachmentRepo.delete).toHaveBeenCalledWith('att-1');
      expect(mockEventBus.emit).toHaveBeenCalledWith('attachments:deleted', { id: 'att-1' });
    });

    it('should throw error if attachment not found', async () => {
      mockAttachmentRepo.findById.mockResolvedValue(null);

      await expect(attachmentService.deleteAttachment('non-existent')).rejects.toThrow(
        'Attachment not found',
      );
    });
  });

  describe('getAttachmentsForNote', () => {
    it('should return attachments for a note', async () => {
      const mockAttachments = [
        { id: 'att-1', filename: 'file1.pdf' },
        { id: 'att-2', filename: 'file2.png' },
      ];
      mockAttachmentRepo.getAttachmentsForNote.mockResolvedValue(mockAttachments);

      const result = await attachmentService.getAttachmentsForNote('note-1');

      expect(result).toEqual(mockAttachments);
      expect(mockAttachmentRepo.getAttachmentsForNote).toHaveBeenCalledWith('note-1');
    });
  });

  describe('uploadImage', () => {
    it('should upload an image to workspace .assets folder', async () => {
      const mockNote = { id: 'note-1', workspaceId: 'ws-1' };
      const mockWorkspace = { id: 'ws-1', folderPath: '/workspace' };

      mockNoteRepo.findById.mockResolvedValue(mockNote);
      mockWorkspaceRepo.findById.mockResolvedValue(mockWorkspace);
      mockFs.existsSync.mockReturnValue(false);

      const result = await attachmentService.uploadImage({
        noteId: 'note-1',
        imageData: 'base64data',
        mimeType: 'image/png',
      });

      expect(result.success).toBe(true);
      expect(result.relativePath).toContain('.assets/');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should throw error if note not found', async () => {
      mockNoteRepo.findById.mockResolvedValue(null);

      await expect(
        attachmentService.uploadImage({
          noteId: 'non-existent',
          imageData: 'data',
          mimeType: 'image/png',
        }),
      ).rejects.toThrow('Note not found');
    });

    it('should throw error if note has no workspace', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'note-1', workspaceId: null });

      await expect(
        attachmentService.uploadImage({
          noteId: 'note-1',
          imageData: 'data',
          mimeType: 'image/png',
        }),
      ).rejects.toThrow('Note has no workspace');
    });

    it('should throw error if workspace not found', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'note-1', workspaceId: 'ws-1' });
      mockWorkspaceRepo.findById.mockResolvedValue(null);

      await expect(
        attachmentService.uploadImage({
          noteId: 'note-1',
          imageData: 'data',
          mimeType: 'image/png',
        }),
      ).rejects.toThrow('Workspace not found');
    });

    it('should use custom filename if provided', async () => {
      const mockNote = { id: 'note-1', workspaceId: 'ws-1' };
      const mockWorkspace = { id: 'ws-1', folderPath: '/workspace' };

      mockNoteRepo.findById.mockResolvedValue(mockNote);
      mockWorkspaceRepo.findById.mockResolvedValue(mockWorkspace);
      mockFs.existsSync.mockReturnValue(false);
      mockMarkdownService.sanitizeFilename.mockReturnValue('custom_image.png');

      const result = await attachmentService.uploadImage({
        noteId: 'note-1',
        imageData: 'base64data',
        mimeType: 'image/png',
        filename: 'custom image.png',
      });

      expect(result.filename).toBe('custom_image.png');
    });

    it('should create .assets folder if it does not exist', async () => {
      const mockNote = { id: 'note-1', workspaceId: 'ws-1' };
      const mockWorkspace = { id: 'ws-1', folderPath: '/workspace' };

      mockNoteRepo.findById.mockResolvedValue(mockNote);
      mockWorkspaceRepo.findById.mockResolvedValue(mockWorkspace);
      mockFs.existsSync.mockReturnValue(false);

      await attachmentService.uploadImage({
        noteId: 'note-1',
        imageData: 'base64data',
        mimeType: 'image/png',
      });

      expect(mockFs.mkdirSync).toHaveBeenCalled();
    });
  });

  describe('getAttachmentService', () => {
    it('should return singleton instance', () => {
      const instance1 = getAttachmentService();
      const instance2 = getAttachmentService();

      expect(instance1).toBe(instance2);
    });
  });
});
