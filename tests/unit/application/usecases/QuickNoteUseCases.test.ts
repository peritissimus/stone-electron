/**
 * QuickNoteUseCases Application Layer Tests
 *
 * Verifies that slot-based quick-note creation resolves the folder on the
 * backend and delegates to CreateNoteUseCase — the renderer only hands over
 * a slot name.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createQuickNoteUseCases } from '../../../../src/main/application/usecases/quickNote';
import type { INoteRepository } from '../../../../src/main/domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../../src/main/domain/ports/out/IFileStorage';
import type { IQuickNoteUseCases } from '../../../../src/main/domain/ports/in/IQuickNoteUseCases';
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

describe('QuickNoteUseCases', () => {
  let noteRepo: INoteRepository;
  let workspaceRepo: IWorkspaceRepository;
  let fileStorage: IFileStorage;
  let useCases: IQuickNoteUseCases;

  beforeEach(() => {
    noteRepo = createMockNoteRepository();
    workspaceRepo = createMockWorkspaceRepository();
    fileStorage = createMockFileStorage();
    vi.mocked(workspaceRepo.findActive).mockResolvedValue(createWorkspaceProps());
    vi.mocked(fileStorage.createDirectory).mockResolvedValue(undefined);
    vi.mocked(fileStorage.write).mockResolvedValue(undefined);
    vi.mocked(noteRepo.save).mockResolvedValue(undefined);
    useCases = createQuickNoteUseCases({
      noteRepository: noteRepo,
      workspaceRepository: workspaceRepo,
      fileStorage,
    });
  });

  describe('createInSlot', () => {
    it('creates a note in the personal slot folder', async () => {
      const result = await useCases.createInSlot({ slot: 'personal' });
      expect(result.noteId).toBeDefined();
      expect(noteRepo.save).toHaveBeenCalled();
      const saved = vi.mocked(noteRepo.save).mock.calls[0][0];
      // Entity API: toSnapshot returns props; fall back to a cast.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filePath = (saved as any).getFilePath?.() ?? (saved as any).props?.filePath;
      expect(filePath).toMatch(/^Personal\//);
    });

    it('creates a note in the work slot folder', async () => {
      const result = await useCases.createInSlot({ slot: 'work' });
      expect(result.noteId).toBeDefined();
      const saved = vi.mocked(noteRepo.save).mock.calls[0][0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filePath = (saved as any).getFilePath?.() ?? (saved as any).props?.filePath;
      expect(filePath).toMatch(/^Work\//);
    });

    it('rejects unknown slots', async () => {
      await expect(
        // @ts-expect-error exercising runtime guard for callers that bypass types
        useCases.createInSlot({ slot: 'invalid' }),
      ).rejects.toThrow(/Unknown quick-note slot/);
    });

    it('passes through an explicit workspaceId onto the saved entity', async () => {
      await useCases.createInSlot({ slot: 'personal', workspaceId: 'ws-2' });
      const saved = vi.mocked(noteRepo.save).mock.calls[0][0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const workspaceId = (saved as any).getWorkspaceId?.() ?? (saved as any).props?.workspaceId;
      expect(workspaceId).toBe('ws-2');
    });

    it('uses the provided title when supplied', async () => {
      await useCases.createInSlot({ slot: 'work', title: 'My Task' });
      const saved = vi.mocked(noteRepo.save).mock.calls[0][0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const title = (saved as any).getTitle?.() ?? (saved as any).props?.title;
      expect(title).toBe('My Task');
    });
  });
});
