/**
 * SyncService Tests
 *
 * Covers file change and rename handlers with mocked repositories.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const loggerSpies = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('../../src/main/utils/logger', () => ({
  logger: loggerSpies,
}));

const mockFileSystemService = vi.hoisted(() => ({
  scanFolder: vi.fn(),
}));

vi.mock('../../src/main/services/FileSystemService', () => ({
  getFileSystemService: vi.fn(() => mockFileSystemService),
  FileSystemService: class {},
}));

const mockNoteRepo = vi.hoisted(() => ({
  findByFilePath: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  findAll: vi.fn(),
}));

const mockWorkspaceRepo = vi.hoisted(() => ({
  findById: vi.fn(),
}));

const mockNotebookRepo = vi.hoisted(() => ({
  findByFolderPath: vi.fn(),
}));

vi.mock('../../src/main/repositories', () => ({
  getRepositories: vi.fn(() => ({
    note: mockNoteRepo,
    workspace: mockWorkspaceRepo,
    notebook: mockNotebookRepo,
  })),
}));

import { getSyncService } from '../../src/main/services/SyncService';

describe('SyncService', () => {
  const syncService = getSyncService();

  beforeEach(() => {
    vi.clearAllMocks();
    (syncService as any).findNotebookIdByFolder = vi.fn(async () => null);
  });

  it('creates a note on file add when none exists', async () => {
    mockNoteRepo.findByFilePath.mockResolvedValue(null);
    mockNoteRepo.create.mockResolvedValue({ id: 'n1' });

    await syncService.handleFileChange('folder/new-note.md', 'ws1', 'add');

    expect(mockNoteRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'new-note',
        filePath: 'folder/new-note.md',
        workspaceId: 'ws1',
      }),
    );
  });

  it('updates timestamp on file change', async () => {
    mockNoteRepo.findByFilePath.mockResolvedValue({ id: 'n1' });

    await syncService.handleFileChange('folder/existing.md', 'ws1', 'change');

    expect(mockNoteRepo.update).toHaveBeenCalledWith('n1', expect.objectContaining({ updatedAt: expect.any(Date) }));
  });

  it('soft deletes on unlink', async () => {
    mockNoteRepo.findByFilePath.mockResolvedValue({ id: 'n1' });

    await syncService.handleFileChange('folder/existing.md', 'ws1', 'unlink');

    expect(mockNoteRepo.update).toHaveBeenCalledWith('n1', expect.objectContaining({ isDeleted: true }));
  });

  it('updates file path on rename', async () => {
    mockNoteRepo.findByFilePath.mockResolvedValue({ id: 'n1' });
    (syncService as any).findNotebookIdByFolder = vi.fn(async () => 'nb1');

    await syncService.handleFileRename('old/path.md', 'new/path.md', 'ws1');

    expect(mockNoteRepo.update).toHaveBeenCalledWith('n1', expect.objectContaining({
      filePath: 'new/path.md',
      notebookId: 'nb1',
    }));
  });

  it('creates notes during syncCreateNewNotes', async () => {
    (syncService as any).findNotebookIdByFolder = vi.fn(async () => 'nb1');
    const results = { created: 0, updated: 0, deleted: 0, errors: [] as string[] };

    await (syncService as any).syncCreateNewNotes(
      [{ relativePath: 'folder/a.md', title: 'A', metadata: { favorite: true } }],
      new Map(),
      new Set(),
      'ws1',
      results,
    );

    expect(mockNoteRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ notebookId: 'nb1', isFavorite: true }),
    );
    expect(results.created).toBe(1);
  });

  it('relocates and deletes notes during syncRelocateOrDeleteNotes', async () => {
    (syncService as any).findNotebookIdByFolder = vi.fn(async () => 'nb1');
    const results = { created: 0, updated: 0, deleted: 0, errors: [] as string[] };
    const notesInDb = [{ id: 'n1', filePath: 'missing.md' }];
    const filesMap = new Map();
    const filesByBase = new Map([['missing.md', [{ relativePath: 'moved.md' }]]]);
    const notesMap = new Map();

    await (syncService as any).syncRelocateOrDeleteNotes(
      notesInDb as any,
      filesMap,
      filesByBase,
      notesMap,
      'ws1',
      results,
    );

    expect(mockNoteRepo.update).toHaveBeenCalledWith(
      'n1',
      expect.objectContaining({ filePath: 'moved.md', notebookId: 'nb1' }),
    );
    expect(results.updated).toBe(1);

    // Soft delete path when no candidates
    const resultsDelete = { created: 0, updated: 0, deleted: 0, errors: [] as string[] };
    await (syncService as any).syncRelocateOrDeleteNotes(
      [{ id: 'n2', filePath: 'gone.md' }] as any,
      filesMap,
      new Map(),
      new Map(),
      'ws1',
      resultsDelete,
    );
    expect(resultsDelete.deleted).toBe(1);
  });

  it('assigns notebooks based on path during syncNotebookAssignments', async () => {
    (syncService as any).findNotebookIdByFolder = vi.fn(async () => 'nb1');
    const results = { created: 0, updated: 0, deleted: 0, errors: [] as string[] };

    await (syncService as any).syncNotebookAssignments(
      [{ id: 'n1', filePath: 'folder/a.md', workspaceId: 'ws1', notebookId: null }] as any,
      'ws1',
      results,
    );

    expect(mockNoteRepo.update).toHaveBeenCalledWith(
      'n1',
      expect.objectContaining({ notebookId: 'nb1' }),
    );
    expect(results.updated).toBe(1);
  });
});
