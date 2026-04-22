/**
 * DatabaseUseCases Application Layer Tests
 *
 * Tests use case orchestration with mocked OUT ports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDatabaseUseCases } from '../../../../src/main/application/usecases/database';
import type { IDatabaseUseCases } from '../../../../src/main/domain/ports/in/IDatabaseUseCases';
import type { INoteRepository } from '../../../../src/main/domain/ports/out/INoteRepository';
import type { INotebookRepository } from '../../../../src/main/domain/ports/out/INotebookRepository';
import type { ITagRepository } from '../../../../src/main/domain/ports/out/ITagRepository';

function createMockDatabaseManager() {
  return {
    getStatus: vi.fn(),
    vacuum: vi.fn(),
    checkIntegrity: vi.fn(),
  };
}

function createMockNoteRepository(): INoteRepository {
  return {
    count: vi.fn().mockResolvedValue(0),
    findById: vi.fn(),
    findAll: vi.fn(),
    findByNotebookId: vi.fn(),
    findByWorkspaceId: vi.fn(),
    findByFilePath: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    searchByTitle: vi.fn(),
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

function createMockNotebookRepository(): INotebookRepository {
  return {
    count: vi.fn().mockResolvedValue(0),
    findById: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
  } as unknown as INotebookRepository;
}

function createMockTagRepository(): ITagRepository {
  return {
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
  } as unknown as ITagRepository;
}

describe('DatabaseUseCases', () => {
  let mockDbManager: ReturnType<typeof createMockDatabaseManager>;
  let noteRepo: INoteRepository;
  let notebookRepo: INotebookRepository;
  let tagRepo: ITagRepository;
  let useCases: IDatabaseUseCases;

  beforeEach(() => {
    mockDbManager = createMockDatabaseManager();
    noteRepo = createMockNoteRepository();
    notebookRepo = createMockNotebookRepository();
    tagRepo = createMockTagRepository();
    useCases = createDatabaseUseCases({
      getDatabaseManager: () => mockDbManager,
      noteRepository: noteRepo,
      notebookRepository: notebookRepo,
      tagRepository: tagRepo,
    });
  });

  describe('getStatus', () => {
    it('returns database status enriched with entity counts', async () => {
      mockDbManager.getStatus.mockResolvedValue({
        path: '/path/to/db.sqlite',
        size: 1024000,
        isOpen: true,
      });
      vi.mocked(noteRepo.count).mockResolvedValue(42);
      vi.mocked(notebookRepo.count).mockResolvedValue(7);
      vi.mocked(tagRepo.findAll).mockResolvedValue([
        { id: 't1' },
        { id: 't2' },
        { id: 't3' },
      ] as never);

      const result = await useCases.getStatus.execute();

      expect(result).toEqual({
        path: '/path/to/db.sqlite',
        databaseSize: 1024000,
        isOpen: true,
        noteCount: 42,
        notebookCount: 7,
        tagCount: 3,
      });
    });

    it('reports isOpen=false for a closed database', async () => {
      mockDbManager.getStatus.mockResolvedValue({
        path: '/path/to/db.sqlite',
        size: 0,
        isOpen: false,
      });

      const result = await useCases.getStatus.execute();

      expect(result.isOpen).toBe(false);
    });
  });

  describe('vacuum', () => {
    it('vacuums the database and reports freed bytes', async () => {
      mockDbManager.getStatus
        .mockResolvedValueOnce({ path: '/db', size: 2_048_000, isOpen: true })
        .mockResolvedValueOnce({ path: '/db', size: 1_024_000, isOpen: true });
      mockDbManager.vacuum.mockResolvedValue(undefined);

      const result = await useCases.vacuum.execute();

      expect(mockDbManager.vacuum).toHaveBeenCalled();
      expect(result).toEqual({
        size_before: 2_048_000,
        size_after: 1_024_000,
        freed_bytes: 1_024_000,
      });
    });
  });

  describe('checkIntegrity', () => {
    it('returns ok when database is healthy', async () => {
      mockDbManager.checkIntegrity.mockResolvedValue({ ok: true, errors: [] });

      const result = await useCases.checkIntegrity.execute();

      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns errors when database has issues', async () => {
      const errors = ['Table notes has orphaned rows', 'Index idx_notes corrupted'];
      mockDbManager.checkIntegrity.mockResolvedValue({ ok: false, errors });

      const result = await useCases.checkIntegrity.execute();

      expect(result.ok).toBe(false);
      expect(result.errors).toEqual(errors);
    });
  });
});
