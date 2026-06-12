import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createIndexUseCases,
  GetIndexStatsUseCase,
  RebuildAllNotesIndexUseCase,
} from '../../../../src/main/application/usecases/indexing';
import type { NoteProps } from '../../../../src/main/domain/entities/Note';
import type { WorkspaceProps } from '../../../../src/main/domain/entities/Workspace';
import type { IIndexNoteUseCase } from '../../../../src/main/domain/ports/in/IIndexUseCases';
import type { IEmbedder } from '../../../../src/main/domain/ports/out/IEmbedder';
import type { IFileStorage } from '../../../../src/main/domain/ports/out/IFileStorage';
import type { IIndexRepository } from '../../../../src/main/domain/ports/out/IIndexRepository';
import type { INoteRepository } from '../../../../src/main/domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';
import { hashText } from '../../../../src/main/domain/services/hashText';
import { createMockPathService } from './testDoubles';

function createMockNoteRepository(): INoteRepository {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
  } as unknown as INoteRepository;
}

function createMockWorkspaceRepository(): IWorkspaceRepository {
  return {
    findById: vi.fn(),
    findActive: vi.fn(),
  } as unknown as IWorkspaceRepository;
}

function createMockFileStorage(): IFileStorage {
  return {
    read: vi.fn(),
  } as unknown as IFileStorage;
}

function createMockEmbedder(): IEmbedder {
  return {
    initialize: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
    generateEmbedding: vi.fn(),
    generateEmbeddings: vi.fn(),
  };
}

function createMockIndexRepository(): IIndexRepository {
  return {
    getStatus: vi.fn(),
    upsertStatus: vi.fn(),
    getWorkspaceStats: vi.fn(),
    replaceChunks: vi.fn(),
    deleteByNoteId: vi.fn(),
    searchFullText: vi.fn(),
    searchVector: vi.fn(),
    getNoteVector: vi.fn(),
    findSimilarNotesByVector: vi.fn(),
    getChunksForWorkspace: vi.fn(),
  };
}

function note(overrides: Partial<NoteProps> = {}): NoteProps {
  return {
    id: 'note-1',
    title: 'Test Note',
    filePath: 'Notes/test.md',
    notebookId: null,
    workspaceId: 'ws-1',
    isFavorite: false,
    isPinned: false,
    isArchived: false,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00'),
    updatedAt: new Date('2026-01-02T00:00:00'),
    ...overrides,
  };
}

function workspace(overrides: Partial<WorkspaceProps> = {}): WorkspaceProps {
  return {
    id: 'ws-1',
    name: 'Workspace',
    folderPath: '/workspace',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00'),
    lastAccessedAt: new Date('2026-01-02T00:00:00'),
    ...overrides,
  };
}

describe('IndexingUseCases', () => {
  let noteRepository: INoteRepository;
  let workspaceRepository: IWorkspaceRepository;
  let fileStorage: IFileStorage;
  let embedder: IEmbedder;
  let indexRepository: IIndexRepository;

  beforeEach(() => {
    noteRepository = createMockNoteRepository();
    workspaceRepository = createMockWorkspaceRepository();
    fileStorage = createMockFileStorage();
    embedder = createMockEmbedder();
    indexRepository = createMockIndexRepository();
  });

  function useCases() {
    return createIndexUseCases({
      noteRepository,
      workspaceRepository,
      fileStorage,
      embedder,
      indexRepository,
      pathService: createMockPathService(),
    });
  }

  it('reports missing when the note cannot be indexed', async () => {
    vi.mocked(noteRepository.findById).mockResolvedValue(null);

    const result = await useCases().indexNote.execute({ noteId: 'missing' });

    expect(result).toEqual({ noteId: 'missing', status: 'missing', chunkCount: 0 });
    expect(indexRepository.replaceChunks).not.toHaveBeenCalled();
  });

  it('marks indexing failed when the markdown file is missing on disk', async () => {
    vi.mocked(noteRepository.findById).mockResolvedValue(note());
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    vi.mocked(fileStorage.read).mockResolvedValue(null);

    const result = await useCases().indexNote.execute({ noteId: 'note-1' });

    expect(result).toEqual({
      noteId: 'note-1',
      status: 'failed',
      chunkCount: 0,
      error: 'file missing',
    });
    expect(indexRepository.upsertStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        noteId: 'note-1',
        workspaceId: 'ws-1',
        status: 'failed',
        error: 'file missing on disk',
      }),
    );
  });

  it('skips indexing when the stored content hash is current', async () => {
    const markdown = '# Title\n\nAlready indexed.';
    vi.mocked(noteRepository.findById).mockResolvedValue(note());
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    vi.mocked(fileStorage.read).mockResolvedValue(markdown);
    vi.mocked(indexRepository.getStatus).mockResolvedValue({
      noteId: 'note-1',
      workspaceId: 'ws-1',
      contentHash: hashText(markdown),
      chunkCount: 3,
      indexedAt: new Date('2026-04-20T10:00:00'),
      model: 'Xenova/bge-small-en-v1.5',
      dimensions: 3,
      status: 'indexed',
      error: null,
    });

    const result = await useCases().indexNote.execute({ noteId: 'note-1' });

    expect(result).toEqual({ noteId: 'note-1', status: 'skipped', chunkCount: 3 });
    expect(embedder.generateEmbeddings).not.toHaveBeenCalled();
  });

  it('indexes markdown chunks with generated embeddings', async () => {
    vi.mocked(noteRepository.findById).mockResolvedValue(note({ title: 'Chunked Note' }));
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    vi.mocked(fileStorage.read).mockResolvedValue('# API\n\nUse stable ports for adapters.');
    vi.mocked(indexRepository.getStatus).mockResolvedValue(null);
    vi.mocked(embedder.isReady).mockReturnValue(false);
    vi.mocked(embedder.generateEmbeddings).mockImplementation(async (texts) =>
      texts.map((_, i) => new Float32Array([i + 1, i + 2, i + 3])),
    );

    const result = await useCases().indexNote.execute({ noteId: 'note-1' });

    expect(embedder.initialize).toHaveBeenCalled();
    expect(indexRepository.replaceChunks).toHaveBeenCalledWith(
      'note-1',
      'ws-1',
      'Chunked Note',
      expect.arrayContaining([
        expect.objectContaining({
          noteId: 'note-1',
          workspaceId: 'ws-1',
          embedding: [1, 2, 3],
        }),
      ]),
    );
    expect(indexRepository.upsertStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        noteId: 'note-1',
        workspaceId: 'ws-1',
        status: 'indexed',
        dimensions: 3,
      }),
    );
    expect(result.status).toBe('indexed');
    expect(result.chunkCount).toBeGreaterThan(0);
  });

  it('marks indexing failed when embedding count does not match chunk count', async () => {
    vi.mocked(noteRepository.findById).mockResolvedValue(note());
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    vi.mocked(fileStorage.read).mockResolvedValue('# API\n\nUse stable ports for adapters.');
    vi.mocked(indexRepository.getStatus).mockResolvedValue(null);
    vi.mocked(embedder.generateEmbeddings).mockResolvedValue([]);

    const result = await useCases().indexNote.execute({ noteId: 'note-1' });

    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/embedding count mismatch/);
    expect(indexRepository.upsertStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', error: result.error }),
    );
  });

  it('rebuilds all active-workspace notes and counts each result status', async () => {
    const indexNote: IIndexNoteUseCase = {
      execute: vi
        .fn()
        .mockResolvedValueOnce({ noteId: 'a', status: 'indexed', chunkCount: 2 })
        .mockResolvedValueOnce({ noteId: 'b', status: 'skipped', chunkCount: 1 })
        .mockResolvedValueOnce({ noteId: 'c', status: 'failed', chunkCount: 0 })
        .mockResolvedValueOnce({ noteId: 'd', status: 'missing', chunkCount: 0 }),
    };
    vi.mocked(workspaceRepository.findActive).mockResolvedValue(workspace());
    vi.mocked(noteRepository.findAll).mockResolvedValue([
      note({ id: 'a' }),
      note({ id: 'b' }),
      note({ id: 'c' }),
      note({ id: 'd' }),
    ]);
    const useCase = new RebuildAllNotesIndexUseCase(
      noteRepository,
      workspaceRepository,
      indexNote,
    );

    const result = await useCase.execute({ force: true });

    expect(noteRepository.findAll).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      isDeleted: false,
    });
    expect(indexNote.execute).toHaveBeenCalledWith({ noteId: 'a', force: true });
    expect(result).toEqual({
      workspaceId: 'ws-1',
      total: 4,
      indexed: 1,
      skipped: 1,
      failed: 1,
      missing: 1,
    });
  });

  it('returns empty rebuild stats when no workspace is active', async () => {
    vi.mocked(workspaceRepository.findActive).mockResolvedValue(null);
    const useCase = new RebuildAllNotesIndexUseCase(noteRepository, workspaceRepository, {
      execute: vi.fn(),
    });

    await expect(useCase.execute()).resolves.toEqual({
      workspaceId: '',
      total: 0,
      indexed: 0,
      skipped: 0,
      failed: 0,
      missing: 0,
    });
  });

  it('loads index stats for an explicit or active workspace', async () => {
    vi.mocked(indexRepository.getWorkspaceStats).mockResolvedValue({
      totalNotes: 10,
      indexedNotes: 8,
      pendingNotes: 1,
      failedNotes: 1,
      chunkCount: 42,
    });
    const useCase = new GetIndexStatsUseCase(indexRepository, workspaceRepository);

    await expect(useCase.execute({ workspaceId: 'ws-explicit' })).resolves.toEqual({
      workspaceId: 'ws-explicit',
      totalNotes: 10,
      indexedNotes: 8,
      pendingNotes: 1,
      failedNotes: 1,
      chunkCount: 42,
    });

    vi.mocked(workspaceRepository.findActive).mockResolvedValue(workspace({ id: 'ws-active' }));
    await useCase.execute();
    expect(indexRepository.getWorkspaceStats).toHaveBeenLastCalledWith('ws-active');
  });
});
