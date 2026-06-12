/**
 * QuickCaptureUseCases Application Layer Tests
 *
 * Tests use case orchestration with mocked OUT ports.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createQuickCaptureUseCases } from '../../../../src/main/application/usecases/quickCapture';
import type { INoteRepository } from '../../../../src/main/domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../../src/main/domain/ports/out/IFileStorage';
import type { IAppConfigRepository } from '../../../../src/main/domain/ports/out/IAppConfigRepository';
import type { ITranscriber } from '../../../../src/main/domain/ports/out/ITranscriber';
import type { IQuickCaptureUseCases } from '../../../../src/main/domain/ports/in/IQuickCaptureUseCases';
import type { NoteProps } from '../../../../src/main/domain/entities/Note';
import type { WorkspaceProps } from '../../../../src/main/domain/entities/Workspace';
import { DEFAULT_APP_CONFIG } from '../../../../src/shared/types/settings';
import { createMockIdGenerator, createMockPathService } from './testDoubles';

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

function createMockTranscriber(): ITranscriber {
  return {
    isReady: vi.fn().mockReturnValue(true),
    initialize: vi.fn(),
    transcribe: vi.fn().mockResolvedValue({ text: '', segments: [], durationMs: 0 }),
  } as unknown as ITranscriber;
}

function createMockFileStorage(): IFileStorage {
  return {
    read: vi.fn(),
    write: vi.fn(),
    writeBytes: vi.fn(),
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

function createMockAppConfigRepository(): IAppConfigRepository {
  return {
    get: vi.fn().mockResolvedValue(DEFAULT_APP_CONFIG),
    set: vi.fn(),
    update: vi.fn(),
  } as unknown as IAppConfigRepository;
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

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const FIXED_NOW = new Date(2026, 3, 24, 12, 0, 0);
const FIXED_TODAY = formatLocalDate(FIXED_NOW);

describe('QuickCaptureUseCases', () => {
  let noteRepo: INoteRepository;
  let workspaceRepo: IWorkspaceRepository;
  let fileStorage: IFileStorage;
  let appConfigRepository: IAppConfigRepository;
  let transcriber: ITranscriber;
  let useCases: IQuickCaptureUseCases;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    noteRepo = createMockNoteRepository();
    workspaceRepo = createMockWorkspaceRepository();
    fileStorage = createMockFileStorage();
    appConfigRepository = createMockAppConfigRepository();
    transcriber = createMockTranscriber();
    useCases = createQuickCaptureUseCases({
      noteRepository: noteRepo,
      workspaceRepository: workspaceRepo,
      fileStorage,
      appConfigRepository,
      idGenerator: createMockIdGenerator(),
      pathService: createMockPathService(),
      transcriber,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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
      const journalNote = createNoteProps({
        id: 'journal-1',
        title: FIXED_TODAY,
        filePath: `Journal/${FIXED_TODAY}.md`,
      });

      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);
      vi.mocked(noteRepo.findByFilePath).mockResolvedValue(journalNote);
      vi.mocked(fileStorage.read).mockResolvedValue(`# ${FIXED_TODAY}\n\nExisting content`);
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

    it('uses the configured journal folder instead of a hardcoded name', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);
      vi.mocked(noteRepo.findByFilePath).mockResolvedValue(null);
      vi.mocked(fileStorage.exists).mockResolvedValue(false);
      vi.mocked(fileStorage.createDirectory).mockResolvedValue(undefined);
      vi.mocked(fileStorage.write).mockResolvedValue(undefined);
      vi.mocked(noteRepo.save).mockResolvedValue(undefined);
      vi.mocked(appConfigRepository.get).mockResolvedValue({
        ...DEFAULT_APP_CONFIG,
        notes: {
          locationPolicy: {
            ...DEFAULT_APP_CONFIG.notes.locationPolicy,
            journalFolder: 'Daily',
          },
        },
      });

      await useCases.appendToJournal('Content');

      expect(noteRepo.findByFilePath).toHaveBeenCalledWith(
        `Daily/${FIXED_TODAY}.md`,
        workspace.id,
      );
      expect(fileStorage.createDirectory).toHaveBeenCalledWith('/test/workspace/Daily');
    });

    it('throws error when no workspace found', async () => {
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(null);

      await expect(useCases.appendToJournal('Content')).rejects.toThrow('No active workspace');
    });
  });

  describe('transcribeVoiceCapture', () => {
    const wav = new Uint8Array([1, 2, 3, 4]);

    it('writes scratch WAV, transcribes, and cleans up', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);
      vi.mocked(fileStorage.createDirectory).mockResolvedValue(undefined);
      vi.mocked(fileStorage.writeBytes).mockResolvedValue(undefined);
      vi.mocked(fileStorage.delete).mockResolvedValue(undefined);
      vi.mocked(transcriber.transcribe).mockResolvedValue({
        text: '  Buy milk tomorrow.  ',
        segments: [],
        durationMs: 2400,
      });

      const result = await useCases.transcribeVoiceCapture({ wav });

      expect(result).toEqual({ text: 'Buy milk tomorrow.', durationMs: 2400 });
      expect(fileStorage.createDirectory).toHaveBeenCalledWith(
        '/test/workspace/.stone/recordings',
      );
      const writtenPath = vi.mocked(fileStorage.writeBytes).mock.calls[0][0];
      expect(writtenPath).toMatch(/^\/test\/workspace\/\.stone\/recordings\/capture-.+\.wav$/);
      expect(transcriber.transcribe).toHaveBeenCalledWith({ audioPath: writtenPath });
      // Scratch audio is deleted after transcription.
      expect(fileStorage.delete).toHaveBeenCalledWith(writtenPath);
    });

    it('cleans up the scratch WAV even when transcription fails', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);
      vi.mocked(fileStorage.createDirectory).mockResolvedValue(undefined);
      vi.mocked(fileStorage.writeBytes).mockResolvedValue(undefined);
      vi.mocked(fileStorage.delete).mockResolvedValue(undefined);
      vi.mocked(transcriber.transcribe).mockRejectedValue(new Error('decode failed'));

      await expect(useCases.transcribeVoiceCapture({ wav })).rejects.toThrow('decode failed');

      expect(fileStorage.delete).toHaveBeenCalled();
    });

    it('throws when no workspace exists', async () => {
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(null);

      await expect(useCases.transcribeVoiceCapture({ wav })).rejects.toThrow(
        'Workspace not found',
      );
      expect(transcriber.transcribe).not.toHaveBeenCalled();
    });
  });
});
