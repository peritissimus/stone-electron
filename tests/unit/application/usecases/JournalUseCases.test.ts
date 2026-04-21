/**
 * JournalUseCases Application Layer Tests
 *
 * Tests the typed journal destination — renderer hands over a date, the use
 * case resolves or creates the corresponding note.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createJournalUseCases } from '../../../../src/main/application/usecases/journal';
import type { INoteRepository } from '../../../../src/main/domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../../src/main/domain/ports/out/IFileStorage';
import type { IJournalUseCases } from '../../../../src/main/domain/ports/in/IJournalUseCases';
import type { NoteProps } from '../../../../src/main/domain/entities/Note';
import type { WorkspaceProps } from '../../../../src/main/domain/entities/Workspace';

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

describe('JournalUseCases', () => {
  let noteRepo: INoteRepository;
  let workspaceRepo: IWorkspaceRepository;
  let fileStorage: IFileStorage;
  let useCases: IJournalUseCases;

  beforeEach(() => {
    noteRepo = createMockNoteRepository();
    workspaceRepo = createMockWorkspaceRepository();
    fileStorage = createMockFileStorage();
    useCases = createJournalUseCases({
      noteRepository: noteRepo,
      workspaceRepository: workspaceRepo,
      fileStorage,
    });
  });

  describe('openOrCreateForDate', () => {
    it('returns the existing note when already indexed', async () => {
      const workspace = createWorkspaceProps();
      const existing = createNoteProps({ id: 'journal-1', title: '2026-04-21' });
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);
      vi.mocked(noteRepo.findByFilePath).mockResolvedValue(existing);

      const result = await useCases.openOrCreateForDate({ date: '2026-04-21' });

      expect(result).toEqual({ noteId: 'journal-1', created: false });
      expect(fileStorage.write).not.toHaveBeenCalled();
      expect(noteRepo.save).not.toHaveBeenCalled();
    });

    it('creates a new note and seed file when nothing exists', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);
      vi.mocked(noteRepo.findByFilePath).mockResolvedValue(null);
      vi.mocked(fileStorage.exists).mockResolvedValue(false);
      vi.mocked(fileStorage.createDirectory).mockResolvedValue(undefined);
      vi.mocked(fileStorage.write).mockResolvedValue(undefined);
      vi.mocked(noteRepo.save).mockResolvedValue(undefined);

      const result = await useCases.openOrCreateForDate({ date: '2026-04-21' });

      expect(result.created).toBe(true);
      expect(fileStorage.createDirectory).toHaveBeenCalled();
      expect(fileStorage.write).toHaveBeenCalled();
      expect(noteRepo.save).toHaveBeenCalled();
    });

    it('indexes a pre-existing file on disk without overwriting it', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);
      vi.mocked(noteRepo.findByFilePath).mockResolvedValue(null);
      vi.mocked(fileStorage.exists).mockResolvedValue(true);
      vi.mocked(noteRepo.save).mockResolvedValue(undefined);

      const result = await useCases.openOrCreateForDate({ date: '2026-04-21' });

      expect(result.created).toBe(false);
      expect(fileStorage.write).not.toHaveBeenCalled();
      expect(noteRepo.save).toHaveBeenCalled();
    });

    it('honours an explicit workspaceId over the active workspace', async () => {
      const workspace = createWorkspaceProps({ id: 'ws-2' });
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(noteRepo.findByFilePath).mockResolvedValue(null);
      vi.mocked(fileStorage.exists).mockResolvedValue(false);
      vi.mocked(fileStorage.createDirectory).mockResolvedValue(undefined);
      vi.mocked(fileStorage.write).mockResolvedValue(undefined);
      vi.mocked(noteRepo.save).mockResolvedValue(undefined);

      await useCases.openOrCreateForDate({ date: '2026-04-21', workspaceId: 'ws-2' });

      expect(workspaceRepo.findById).toHaveBeenCalledWith('ws-2');
      expect(workspaceRepo.findActive).not.toHaveBeenCalled();
    });

    it('throws when no workspace can be resolved', async () => {
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(null);

      await expect(useCases.openOrCreateForDate({ date: '2026-04-21' })).rejects.toThrow(
        'No active workspace',
      );
    });

    it('rejects an unparsable date input', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);

      await expect(useCases.openOrCreateForDate({ date: 'not-a-date' })).rejects.toThrow(
        /Invalid journal date/,
      );
    });
  });
});
