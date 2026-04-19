/**
 * AttachmentUseCases Application Layer Tests
 *
 * Tests use case orchestration with mocked OUT ports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAttachmentUseCases } from '../../../../src/main/application/usecases/attachment';
import type { INoteRepository } from '../../../../src/main/domain/ports/out/INoteRepository';
import type { IAttachmentRepository } from '../../../../src/main/domain/ports/out/IAttachmentRepository';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../../src/main/domain/ports/out/IFileStorage';
import type { IAttachmentUseCases } from '../../../../src/main/domain/ports/in/IAttachmentUseCases';
import type { NoteProps } from '../../../../src/main/domain/entities/Note';
import type { WorkspaceProps } from '../../../../src/main/domain/entities/Workspace';
import type { AttachmentProps } from '../../../../src/main/domain/entities/Attachment';

// Mock factories
function createMockNoteRepository(): INoteRepository {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  } as unknown as INoteRepository;
}

function createMockAttachmentRepository(): IAttachmentRepository {
  return {
    findById: vi.fn(),
    findByNoteId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  } as unknown as IAttachmentRepository;
}

function createMockWorkspaceRepository(): IWorkspaceRepository {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    findActive: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  } as unknown as IWorkspaceRepository;
}

function createMockFileStorage(): IFileStorage {
  return {
    read: vi.fn(),
    write: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    copy: vi.fn(),
    createDirectory: vi.fn(),
    getFileInfo: vi.fn(),
  } as unknown as IFileStorage;
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

function createWorkspaceProps(overrides: Partial<WorkspaceProps> = {}): WorkspaceProps {
  return {
    id: 'ws-1',
    name: 'Test Workspace',
    folderPath: '/test/workspace',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    lastAccessedAt: new Date('2024-01-02'),
    ...overrides,
  };
}

function createAttachmentProps(overrides: Partial<AttachmentProps> = {}): AttachmentProps {
  return {
    id: 'att-1',
    noteId: 'note-1',
    filename: 'image.png',
    mimeType: 'image/png',
    size: 1024,
    path: '.attachments/note-1/image.png',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('AttachmentUseCases', () => {
  let noteRepo: INoteRepository;
  let attachmentRepo: IAttachmentRepository;
  let workspaceRepo: IWorkspaceRepository;
  let fileStorage: IFileStorage;
  let useCases: IAttachmentUseCases;

  beforeEach(() => {
    noteRepo = createMockNoteRepository();
    attachmentRepo = createMockAttachmentRepository();
    workspaceRepo = createMockWorkspaceRepository();
    fileStorage = createMockFileStorage();
    useCases = createAttachmentUseCases({
      noteRepository: noteRepo,
      attachmentRepository: attachmentRepo,
      workspaceRepository: workspaceRepo,
      fileStorage,
    });
  });

  describe('addAttachment', () => {
    it('adds attachment to note', async () => {
      const note = createNoteProps();
      const workspace = createWorkspaceProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.createDirectory).mockResolvedValue(undefined);
      vi.mocked(fileStorage.copy).mockResolvedValue(undefined);
      vi.mocked(fileStorage.getFileInfo).mockResolvedValue({
        path: '/test/file',
        name: 'file',
        size: 1024,
        isDirectory: false,
        createdAt: new Date(),
        modifiedAt: new Date(),
      });
      vi.mocked(attachmentRepo.save).mockResolvedValue(undefined);

      const result = await useCases.addAttachment('note-1', '/path/to/image.png');

      expect(result.noteId).toBe('note-1');
      expect(result.isImage).toBe(true);
      expect(fileStorage.copy).toHaveBeenCalled();
      expect(attachmentRepo.save).toHaveBeenCalled();
    });

    it('uses custom filename when provided', async () => {
      const note = createNoteProps();
      const workspace = createWorkspaceProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.createDirectory).mockResolvedValue(undefined);
      vi.mocked(fileStorage.copy).mockResolvedValue(undefined);
      vi.mocked(fileStorage.getFileInfo).mockResolvedValue({
        path: '/test/file',
        name: 'file',
        size: 1024,
        isDirectory: false,
        createdAt: new Date(),
        modifiedAt: new Date(),
      });
      vi.mocked(attachmentRepo.save).mockResolvedValue(undefined);

      const result = await useCases.addAttachment('note-1', '/path/to/file', 'custom.pdf');

      expect(result.isPdf).toBe(true);
    });

    it('throws error when note not found', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(useCases.addAttachment('nonexistent', '/path')).rejects.toThrow(
        'Note not found: nonexistent',
      );
    });

    it('throws error when workspace not found', async () => {
      const note = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(null);

      await expect(useCases.addAttachment('note-1', '/path')).rejects.toThrow(
        'Workspace not found: ws-1',
      );
    });
  });

  describe('deleteAttachment', () => {
    it('deletes attachment and file', async () => {
      const attachment = createAttachmentProps();
      const note = createNoteProps();
      const workspace = createWorkspaceProps();
      vi.mocked(attachmentRepo.findById).mockResolvedValue(attachment);
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.delete).mockResolvedValue(undefined);
      vi.mocked(attachmentRepo.delete).mockResolvedValue(undefined);

      await useCases.deleteAttachment('att-1');

      expect(fileStorage.delete).toHaveBeenCalled();
      expect(attachmentRepo.delete).toHaveBeenCalledWith('att-1');
    });

    it('skips file deletion when deleteFile is false', async () => {
      const attachment = createAttachmentProps();
      vi.mocked(attachmentRepo.findById).mockResolvedValue(attachment);
      vi.mocked(attachmentRepo.delete).mockResolvedValue(undefined);

      await useCases.deleteAttachment('att-1', false);

      expect(fileStorage.delete).not.toHaveBeenCalled();
      expect(attachmentRepo.delete).toHaveBeenCalledWith('att-1');
    });

    it('throws error when attachment not found', async () => {
      vi.mocked(attachmentRepo.findById).mockResolvedValue(null);

      await expect(useCases.deleteAttachment('nonexistent')).rejects.toThrow(
        'Attachment not found: nonexistent',
      );
    });
  });

  describe('getAttachments', () => {
    it('returns attachments for note', async () => {
      const attachments = [
        createAttachmentProps({ id: 'att-1', filename: 'image.png', mimeType: 'image/png' }),
        createAttachmentProps({ id: 'att-2', filename: 'doc.pdf', mimeType: 'application/pdf' }),
      ];
      vi.mocked(attachmentRepo.findByNoteId).mockResolvedValue(attachments);

      const result = await useCases.getAttachments('note-1');

      expect(result).toHaveLength(2);
      expect(result[0].isImage).toBe(true);
      expect(result[1].isPdf).toBe(true);
    });

    it('returns empty array when no attachments', async () => {
      vi.mocked(attachmentRepo.findByNoteId).mockResolvedValue([]);

      const result = await useCases.getAttachments('note-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('uploadImage', () => {
    it('uploads image from buffer', async () => {
      const note = createNoteProps();
      const workspace = createWorkspaceProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.createDirectory).mockResolvedValue(undefined);
      vi.mocked(fileStorage.write).mockResolvedValue(undefined);
      vi.mocked(fileStorage.copy).mockResolvedValue(undefined);
      vi.mocked(fileStorage.delete).mockResolvedValue(undefined);
      vi.mocked(fileStorage.getFileInfo).mockResolvedValue({
        path: '/test/file',
        name: 'file',
        size: 1024,
        isDirectory: false,
        createdAt: new Date(),
        modifiedAt: new Date(),
      });
      vi.mocked(attachmentRepo.save).mockResolvedValue(undefined);

      const imageBuffer = Buffer.from('fake image data');
      const result = await useCases.uploadImage('note-1', imageBuffer, 'screenshot.png');

      expect(result.attachment).toBeDefined();
      expect(result.markdownLink).toContain('screenshot.png');
    });

    it('uploads image from base64 string', async () => {
      const note = createNoteProps();
      const workspace = createWorkspaceProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.createDirectory).mockResolvedValue(undefined);
      vi.mocked(fileStorage.write).mockResolvedValue(undefined);
      vi.mocked(fileStorage.copy).mockResolvedValue(undefined);
      vi.mocked(fileStorage.delete).mockResolvedValue(undefined);
      vi.mocked(fileStorage.getFileInfo).mockResolvedValue({
        path: '/test/file',
        name: 'file',
        size: 1024,
        isDirectory: false,
        createdAt: new Date(),
        modifiedAt: new Date(),
      });
      vi.mocked(attachmentRepo.save).mockResolvedValue(undefined);

      const base64Data = Buffer.from('fake image data').toString('base64');
      const result = await useCases.uploadImage('note-1', base64Data, 'photo.jpg');

      expect(result.attachment).toBeDefined();
      expect(result.markdownLink).toContain('photo.jpg');
    });

    it('throws error when note not found', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(
        useCases.uploadImage('nonexistent', Buffer.from('data'), 'test.png'),
      ).rejects.toThrow('Note not found: nonexistent');
    });
  });
});
