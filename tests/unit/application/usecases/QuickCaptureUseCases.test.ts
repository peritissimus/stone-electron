/**
 * QuickCaptureUseCases Application Layer Tests
 *
 * Tests use case orchestration with mocked OUT ports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createQuickCaptureUseCases } from '../../../../src/main/application/usecases/quickCapture';
import type { INoteRepository } from '../../../../src/main/domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../../src/main/domain/ports/out/IFileStorage';
import type { IQuickCaptureUseCases } from '../../../../src/main/domain/ports/in/IQuickCaptureUseCases';
import type { NoteProps } from '../../../../src/main/domain/entities/Note';
import type { WorkspaceProps } from '../../../../src/main/domain/entities/Workspace';

// Mock factories
function createMockNoteRepository(): INoteRepository {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    findByNotebookId: vi.fn(),
    findByWorkspaceId: vi.fn(),
    findByFilePath: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    searchByTitle: vi.fn(),
    count: vi.fn(),
    exists: vi.fn(),
    findRecentlyUpdated: vi.fn(),
    findFavorites: vi.fn(),
    findPinned: vi.fn(),
    findArchived: vi.fn(),
    findDeleted: vi.fn(),
    getContentById: vi.fn(),
    getEmbedding: vi.fn(),
    updateEmbedding: vi.fn(),
    findBySimilarity: vi.fn(),
  } as unknown as INoteRepository;
}

function createMockWorkspaceRepository(): IWorkspaceRepository {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    findActive: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    setActive: vi.fn(),
  } as unknown as IWorkspaceRepository;
}

function createMockFileStorage(): IFileStorage {
  return {
    read: vi.fn(),
    write: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    rename: vi.fn(),
    createDirectory: vi.fn(),
    deleteDirectory: vi.fn(),
    listFiles: vi.fn(),
    glob: vi.fn(),
    getFileInfo: vi.fn(),
    copy: vi.fn(),
    watch: vi.fn(),
  } as unknown as IFileStorage;
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

describe('QuickCaptureUseCases', () => {
  let noteRepo: INoteRepository;
  let workspaceRepo: IWorkspaceRepository;
  let fileStorage: IFileStorage;
  let useCases: IQuickCaptureUseCases;

  beforeEach(() => {
    noteRepo = createMockNoteRepository();
    workspaceRepo = createMockWorkspaceRepository();
    fileStorage = createMockFileStorage();
    useCases = createQuickCaptureUseCases({
      noteRepository: noteRepo,
      workspaceRepository: workspaceRepo,
      fileStorage,
    });
  });

  describe('appendToJournal', () => {
    it('creates new journal note when none exists', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);
      vi.mocked(noteRepo.findAll).mockResolvedValue([]);
      vi.mocked(fileStorage.createDirectory).mockResolvedValue(undefined);
      vi.mocked(fileStorage.write).mockResolvedValue(undefined);
      vi.mocked(noteRepo.save).mockResolvedValue(undefined);

      const result = await useCases.appendToJournal('Hello world');

      expect(result.appended).toBe(false);
      expect(result.noteId).toBeDefined();
      expect(fileStorage.createDirectory).toHaveBeenCalled();
      expect(fileStorage.write).toHaveBeenCalled();
      expect(noteRepo.save).toHaveBeenCalled();
    });

    it('appends to existing journal note', async () => {
      const workspace = createWorkspaceProps();
      const today = new Date().toISOString().split('T')[0];
      const journalNote = createNoteProps({
        id: 'journal-1',
        title: today,
        filePath: `Journal/${today}.md`,
      });

      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);
      vi.mocked(noteRepo.findByFilePath).mockResolvedValue(journalNote);
      vi.mocked(fileStorage.read).mockResolvedValue(`# ${today}\n\nExisting content`);
      vi.mocked(fileStorage.write).mockResolvedValue(undefined);
      vi.mocked(noteRepo.save).mockResolvedValue(undefined);

      const result = await useCases.appendToJournal('New entry');

      expect(result.appended).toBe(true);
      expect(result.noteId).toBe('journal-1');
      expect(fileStorage.read).toHaveBeenCalled();
      expect(fileStorage.write).toHaveBeenCalled();
    });

    it('uses specific workspace when provided', async () => {
      const workspace = createWorkspaceProps({ id: 'ws-2' });
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(noteRepo.findAll).mockResolvedValue([]);
      vi.mocked(fileStorage.createDirectory).mockResolvedValue(undefined);
      vi.mocked(fileStorage.write).mockResolvedValue(undefined);
      vi.mocked(noteRepo.save).mockResolvedValue(undefined);

      await useCases.appendToJournal('Content', 'ws-2');

      expect(workspaceRepo.findById).toHaveBeenCalledWith('ws-2');
      expect(workspaceRepo.findActive).not.toHaveBeenCalled();
    });

    it('throws error when no workspace found', async () => {
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(null);

      await expect(useCases.appendToJournal('Content')).rejects.toThrow('No active workspace');
    });
  });
});
