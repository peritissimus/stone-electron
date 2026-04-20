/**
 * NoteUseCases Application Layer Tests
 *
 * Tests use case orchestration with mocked OUT ports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GetNoteUseCase,
  CreateNoteUseCase,
  UpdateNoteUseCase,
  DeleteNoteUseCase,
  RestoreNoteUseCase,
  MoveNoteUseCase,
  SearchNotesUseCase,
  GetNoteContentUseCase,
  SaveNoteContentUseCase,
  GetNoteByPathUseCase,
  ToggleFavoriteUseCase,
  TogglePinUseCase,
  ToggleArchiveUseCase,
  ListNotesUseCase,
} from '../../../../src/main/application/usecases/note';
import type { INoteRepository } from '../../../../src/main/domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../../src/main/domain/ports/out/IFileStorage';
import type { IMarkdownProcessor } from '../../../../src/main/domain/ports/out/IMarkdownProcessor';
import type { IEventPublisher } from '../../../../src/main/domain/ports/out/IEventPublisher';
import { NoteNotFoundError } from '../../../../src/main/domain/errors';
import type { NoteProps } from '../../../../src/main/domain/entities/Note';

// Mock factories using type assertions
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
    findByFolderPath: vi.fn(),
    findAll: vi.fn(),
    findActive: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    setActive: vi.fn(),
    exists: vi.fn(),
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

function createMockMarkdownProcessor(): IMarkdownProcessor {
  return {
    htmlToMarkdown: vi.fn(),
    markdownToHtml: vi.fn(),
    parseFrontmatter: vi.fn(),
    updateFrontmatter: vi.fn(),
    extractTitle: vi.fn(),
    extractPlainText: vi.fn(),
    extractLinks: vi.fn(),
    extractWikiLinks: vi.fn(),
    htmlToPlainText: vi.fn(),
  } as unknown as IMarkdownProcessor;
}

function createMockEventPublisher(): IEventPublisher {
  return {
    publish: vi.fn(),
    publishAll: vi.fn(),
    emit: vi.fn(),
    subscribe: vi.fn(),
    subscribeAll: vi.fn(),
  } as unknown as IEventPublisher;
}

function createNoteProps(overrides: Partial<NoteProps> = {}): NoteProps {
  return {
    id: 'note-1',
    title: 'Test Note',
    filePath: 'Personal/test.md',
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

describe('NoteUseCases', () => {
  describe('GetNoteUseCase', () => {
    let noteRepo: INoteRepository;
    let workspaceRepo: IWorkspaceRepository;
    let fileStorage: IFileStorage;
    let useCase: GetNoteUseCase;

    beforeEach(() => {
      noteRepo = createMockNoteRepository();
      workspaceRepo = createMockWorkspaceRepository();
      fileStorage = createMockFileStorage();
      useCase = new GetNoteUseCase(noteRepo, workspaceRepo, fileStorage);
    });

    it('returns note without content by default', async () => {
      const noteProps = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(noteProps);

      const result = await useCase.execute({ id: 'note-1' });

      expect(result.note).toEqual(noteProps);
      expect(result.content).toBeUndefined();
      expect(noteRepo.findById).toHaveBeenCalledWith('note-1');
    });

    it('returns note with raw markdown content when requested', async () => {
      const noteProps = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(noteProps);
      vi.mocked(workspaceRepo.findActive).mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      } as any);
      vi.mocked(workspaceRepo.findById).mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      } as any);
      vi.mocked(fileStorage.exists).mockResolvedValue(true);
      vi.mocked(fileStorage.read).mockResolvedValue('# Test');

      const result = await useCase.execute({ id: 'note-1', includeContent: true });

      expect(result.note).toEqual(noteProps);
      expect(result.content).toBe('# Test');
    });

    it('throws NoteNotFoundError when note does not exist', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute({ id: 'nonexistent' })).rejects.toThrow(NoteNotFoundError);
    });
  });

  describe('CreateNoteUseCase', () => {
    let noteRepo: INoteRepository;
    let workspaceRepo: IWorkspaceRepository;
    let fileStorage: IFileStorage;
    let markdownProcessor: IMarkdownProcessor;
    let eventPublisher: IEventPublisher;
    let useCase: CreateNoteUseCase;

    beforeEach(() => {
      noteRepo = createMockNoteRepository();
      workspaceRepo = createMockWorkspaceRepository();
      fileStorage = createMockFileStorage();
      markdownProcessor = createMockMarkdownProcessor();
      eventPublisher = createMockEventPublisher();
      useCase = new CreateNoteUseCase(
        noteRepo,
        workspaceRepo,
        fileStorage,
        eventPublisher,
      );
    });

    it('creates a new note', async () => {
      vi.mocked(workspaceRepo.findActive).mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      } as any);
      vi.mocked(markdownProcessor.htmlToMarkdown).mockReturnValue('# New Note');
      vi.mocked(fileStorage.write).mockResolvedValue(undefined);
      vi.mocked(noteRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({
        title: 'New Note',
        content: '<h1>New Note</h1>',
      });

      expect(result.note.title).toBe('New Note');
      expect(result.note.workspaceId).toBe('ws-1');
      expect(fileStorage.write).toHaveBeenCalled();
      expect(noteRepo.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('throws error when no active workspace', async () => {
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(null);

      await expect(
        useCase.execute({
          title: 'New Note',
        }),
      ).rejects.toThrow('No active workspace');
    });
  });

  describe('UpdateNoteUseCase', () => {
    let noteRepo: INoteRepository;
    let workspaceRepo: IWorkspaceRepository;
    let fileStorage: IFileStorage;
    let markdownProcessor: IMarkdownProcessor;
    let eventPublisher: IEventPublisher;
    let useCase: UpdateNoteUseCase;

    beforeEach(() => {
      noteRepo = createMockNoteRepository();
      workspaceRepo = createMockWorkspaceRepository();
      fileStorage = createMockFileStorage();
      markdownProcessor = createMockMarkdownProcessor();
      eventPublisher = createMockEventPublisher();
      useCase = new UpdateNoteUseCase(
        noteRepo,
        workspaceRepo,
        fileStorage,
        eventPublisher,
      );
    });

    it('updates note properties', async () => {
      const noteProps = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(noteProps);
      vi.mocked(noteRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({
        id: 'note-1',
        title: 'Updated Title',
        isFavorite: true,
      });

      expect(result.note.title).toBe('Updated Title');
      expect(result.note.isFavorite).toBe(true);
      expect(noteRepo.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('updates content', async () => {
      const noteProps = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(noteProps);
      vi.mocked(workspaceRepo.findById).mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      } as any);
      vi.mocked(markdownProcessor.htmlToMarkdown).mockReturnValue('# Updated Content');
      vi.mocked(fileStorage.write).mockResolvedValue(undefined);
      vi.mocked(noteRepo.save).mockResolvedValue(undefined);

      await useCase.execute({
        id: 'note-1',
        content: '<h1>Updated Content</h1>',
      });

      expect(fileStorage.write).toHaveBeenCalled();
      expect(noteRepo.save).toHaveBeenCalled();
    });

    it('throws NoteNotFoundError for nonexistent note', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(
        useCase.execute({
          id: 'nonexistent',
          title: 'New Title',
        }),
      ).rejects.toThrow(NoteNotFoundError);
    });
  });

  describe('DeleteNoteUseCase', () => {
    let noteRepo: INoteRepository;
    let workspaceRepo: IWorkspaceRepository;
    let fileStorage: IFileStorage;
    let eventPublisher: IEventPublisher;
    let useCase: DeleteNoteUseCase;

    beforeEach(() => {
      noteRepo = createMockNoteRepository();
      workspaceRepo = createMockWorkspaceRepository();
      fileStorage = createMockFileStorage();
      eventPublisher = createMockEventPublisher();
      useCase = new DeleteNoteUseCase(noteRepo, workspaceRepo, fileStorage, eventPublisher);
    });

    it('soft deletes note by default', async () => {
      const noteProps = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(noteProps);
      vi.mocked(noteRepo.save).mockResolvedValue(undefined);

      await useCase.execute({ id: 'note-1' });

      expect(noteRepo.save).toHaveBeenCalled();
      expect(noteRepo.delete).not.toHaveBeenCalled();
    });

    it('permanently deletes note when permanent flag is true', async () => {
      const noteProps = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(noteProps);
      vi.mocked(noteRepo.delete).mockResolvedValue(undefined);
      vi.mocked(workspaceRepo.findById).mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      } as any);
      vi.mocked(fileStorage.exists).mockResolvedValue(true);
      vi.mocked(fileStorage.delete).mockResolvedValue(undefined);

      await useCase.execute({ id: 'note-1', permanent: true });

      expect(noteRepo.delete).toHaveBeenCalledWith('note-1');
    });

    it('throws NoteNotFoundError for nonexistent note', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute({ id: 'nonexistent' })).rejects.toThrow(NoteNotFoundError);
    });
  });

  describe('SearchNotesUseCase', () => {
    let noteRepo: INoteRepository;
    let workspaceRepo: IWorkspaceRepository;
    let useCase: SearchNotesUseCase;

    beforeEach(() => {
      noteRepo = createMockNoteRepository();
      workspaceRepo = createMockWorkspaceRepository();
      useCase = new SearchNotesUseCase(noteRepo, workspaceRepo);
    });

    it('searches notes by title', async () => {
      const notes = [createNoteProps()];
      vi.mocked(workspaceRepo.findActive).mockResolvedValue({ id: 'ws-1' } as any);
      vi.mocked(noteRepo.searchByTitle).mockResolvedValue(notes);

      const result = await useCase.execute({ query: 'Test' });

      expect(result.notes).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(noteRepo.searchByTitle).toHaveBeenCalledWith({
        query: 'Test',
        workspaceId: 'ws-1',
        limit: undefined,
      });
    });
  });

  describe('GetNoteContentUseCase', () => {
    let noteRepo: INoteRepository;
    let workspaceRepo: IWorkspaceRepository;
    let fileStorage: IFileStorage;
    let useCase: GetNoteContentUseCase;

    beforeEach(() => {
      noteRepo = createMockNoteRepository();
      workspaceRepo = createMockWorkspaceRepository();
      fileStorage = createMockFileStorage();
      useCase = new GetNoteContentUseCase(noteRepo, workspaceRepo, fileStorage);
    });

    it('returns raw markdown body when file exists', async () => {
      const noteProps = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(noteProps);
      vi.mocked(workspaceRepo.findById).mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      } as any);
      vi.mocked(fileStorage.exists).mockResolvedValue(true);
      vi.mocked(fileStorage.read).mockResolvedValue('# Title\n\nBody text');

      const result = await useCase.execute({ id: 'note-1' });

      expect(result.content).toBe('Body text');
    });

    it('returns empty string when file does not exist', async () => {
      const noteProps = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(noteProps);
      vi.mocked(workspaceRepo.findById).mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      } as any);
      vi.mocked(fileStorage.exists).mockResolvedValue(false);

      const result = await useCase.execute({ id: 'note-1' });

      expect(result.content).toBe('');
    });

    it('returns empty string when note has no file path', async () => {
      const noteProps = createNoteProps({ filePath: null });
      vi.mocked(noteRepo.findById).mockResolvedValue(noteProps);

      const result = await useCase.execute({ id: 'note-1' });

      expect(result.content).toBe('');
    });

    it('throws NoteNotFoundError for nonexistent note', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute({ id: 'nonexistent' })).rejects.toThrow(NoteNotFoundError);
    });
  });

  describe('SaveNoteContentUseCase', () => {
    let noteRepo: INoteRepository;
    let workspaceRepo: IWorkspaceRepository;
    let fileStorage: IFileStorage;
    let markdownProcessor: IMarkdownProcessor;
    let useCase: SaveNoteContentUseCase;

    beforeEach(() => {
      noteRepo = createMockNoteRepository();
      workspaceRepo = createMockWorkspaceRepository();
      fileStorage = createMockFileStorage();
      markdownProcessor = createMockMarkdownProcessor();
      useCase = new SaveNoteContentUseCase(noteRepo, workspaceRepo, fileStorage);
    });

    it('saves content to file', async () => {
      const noteProps = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(noteProps);
      vi.mocked(workspaceRepo.findById).mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      } as any);
      vi.mocked(markdownProcessor.htmlToMarkdown).mockReturnValue('# Content');
      vi.mocked(fileStorage.write).mockResolvedValue(undefined);

      await useCase.execute({ id: 'note-1', content: '<h1>Content</h1>' });

      expect(fileStorage.write).toHaveBeenCalled();
    });

    it('throws error when note has no file path', async () => {
      const noteProps = createNoteProps({ filePath: null });
      vi.mocked(noteRepo.findById).mockResolvedValue(noteProps);

      await expect(useCase.execute({ id: 'note-1', content: 'content' })).rejects.toThrow(
        'Note has no file path',
      );
    });
  });

  describe('GetNoteByPathUseCase', () => {
    let noteRepo: INoteRepository;
    let workspaceRepo: IWorkspaceRepository;
    let fileStorage: IFileStorage;
    let markdownProcessor: IMarkdownProcessor;
    let eventPublisher: IEventPublisher;
    let useCase: GetNoteByPathUseCase;

    beforeEach(() => {
      noteRepo = createMockNoteRepository();
      workspaceRepo = createMockWorkspaceRepository();
      fileStorage = createMockFileStorage();
      markdownProcessor = createMockMarkdownProcessor();
      eventPublisher = createMockEventPublisher();
      useCase = new GetNoteByPathUseCase(
        noteRepo,
        workspaceRepo,
        fileStorage,
        markdownProcessor,
        eventPublisher,
      );
    });

    it('returns note by file path when found in database', async () => {
      const noteProps = createNoteProps();
      vi.mocked(workspaceRepo.findActive).mockResolvedValue({ id: 'ws-1' } as any);
      vi.mocked(noteRepo.findByFilePath).mockResolvedValue(noteProps);

      const result = await useCase.execute({ filePath: 'test.md' });

      expect(result.note).toEqual(noteProps);
    });

    it('creates note from disk when not in database but file exists', async () => {
      vi.mocked(workspaceRepo.findActive).mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      } as any);
      vi.mocked(noteRepo.findByFilePath).mockResolvedValue(null);
      vi.mocked(fileStorage.exists).mockResolvedValue(true);
      vi.mocked(fileStorage.read).mockResolvedValue('# My Note\nContent here');
      vi.mocked(markdownProcessor.extractTitle).mockReturnValue('My Note');
      vi.mocked(noteRepo.save).mockResolvedValue();

      const result = await useCase.execute({ filePath: 'test.md' });

      expect(result.note.title).toBe('My Note');
      expect(result.note.filePath).toBe('test.md');
      expect(noteRepo.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('uses filename as title for journal files (not extracted title)', async () => {
      vi.mocked(workspaceRepo.findActive).mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      } as any);
      vi.mocked(noteRepo.findByFilePath).mockResolvedValue(null);
      vi.mocked(fileStorage.exists).mockResolvedValue(true);
      vi.mocked(fileStorage.read).mockResolvedValue('# January 11, 2026\n\nJournal content');
      vi.mocked(markdownProcessor.extractTitle).mockReturnValue('January 11, 2026');
      vi.mocked(noteRepo.save).mockResolvedValue();

      const result = await useCase.execute({ filePath: 'Journal/2026-01-11.md' });

      // Should use filename format, not extracted title
      expect(result.note.title).toBe('2026-01-11');
      expect(result.note.filePath).toBe('Journal/2026-01-11.md');
      expect(noteRepo.save).toHaveBeenCalled();
    });

    it('throws NoteNotFoundError when note not in DB and file does not exist', async () => {
      vi.mocked(workspaceRepo.findActive).mockResolvedValue({
        id: 'ws-1',
        folderPath: '/workspace',
      } as any);
      vi.mocked(noteRepo.findByFilePath).mockResolvedValue(null);
      vi.mocked(fileStorage.exists).mockResolvedValue(false);

      await expect(useCase.execute({ filePath: 'nonexistent.md' })).rejects.toThrow(
        NoteNotFoundError,
      );
    });
  });

  describe('RestoreNoteUseCase', () => {
    let noteRepo: INoteRepository;
    let eventPublisher: IEventPublisher;
    let useCase: RestoreNoteUseCase;

    beforeEach(() => {
      noteRepo = createMockNoteRepository();
      eventPublisher = createMockEventPublisher();
      useCase = new RestoreNoteUseCase(noteRepo, eventPublisher);
    });

    it('restores soft-deleted note', async () => {
      const noteProps = createNoteProps({ isDeleted: true, deletedAt: new Date() });
      vi.mocked(noteRepo.findById).mockResolvedValue(noteProps);
      vi.mocked(noteRepo.save).mockResolvedValue(undefined);

      await useCase.execute({ id: 'note-1' });

      // RestoreNoteUseCase returns void, verify via save call
      expect(noteRepo.save).toHaveBeenCalled();
    });

    it('throws NoteNotFoundError for nonexistent note', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute({ id: 'nonexistent' })).rejects.toThrow(NoteNotFoundError);
    });
  });

  describe('MoveNoteUseCase', () => {
    let noteRepo: INoteRepository;
    let eventPublisher: IEventPublisher;
    let useCase: MoveNoteUseCase;

    beforeEach(() => {
      noteRepo = createMockNoteRepository();
      eventPublisher = createMockEventPublisher();
      useCase = new MoveNoteUseCase(noteRepo, eventPublisher);
    });

    it('moves note to different notebook', async () => {
      const noteProps = createNoteProps({ notebookId: 'nb-1' });
      vi.mocked(noteRepo.findById).mockResolvedValue(noteProps);
      vi.mocked(noteRepo.save).mockResolvedValue(undefined);

      await useCase.execute({ id: 'note-1', targetNotebookId: 'nb-2' });

      expect(noteRepo.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('throws NoteNotFoundError for nonexistent note', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(
        useCase.execute({ id: 'nonexistent', targetNotebookId: 'nb-1' }),
      ).rejects.toThrow(NoteNotFoundError);
    });
  });

  describe('ToggleFavoriteUseCase', () => {
    let noteRepo: INoteRepository;
    let eventPublisher: IEventPublisher;
    let useCase: ToggleFavoriteUseCase;

    beforeEach(() => {
      noteRepo = createMockNoteRepository();
      eventPublisher = createMockEventPublisher();
      useCase = new ToggleFavoriteUseCase(noteRepo, eventPublisher);
    });

    it('toggles favorite status', async () => {
      const noteProps = createNoteProps({ isFavorite: false });
      vi.mocked(noteRepo.findById).mockResolvedValue(noteProps);
      vi.mocked(noteRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({ id: 'note-1' });

      expect(result.note.isFavorite).toBe(true);
      expect(noteRepo.save).toHaveBeenCalled();
    });

    it('throws NoteNotFoundError for nonexistent note', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute({ id: 'nonexistent' })).rejects.toThrow(NoteNotFoundError);
    });
  });

  describe('TogglePinUseCase', () => {
    let noteRepo: INoteRepository;
    let eventPublisher: IEventPublisher;
    let useCase: TogglePinUseCase;

    beforeEach(() => {
      noteRepo = createMockNoteRepository();
      eventPublisher = createMockEventPublisher();
      useCase = new TogglePinUseCase(noteRepo, eventPublisher);
    });

    it('toggles pinned status', async () => {
      const noteProps = createNoteProps({ isPinned: false });
      vi.mocked(noteRepo.findById).mockResolvedValue(noteProps);
      vi.mocked(noteRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({ id: 'note-1' });

      expect(result.note.isPinned).toBe(true);
      expect(noteRepo.save).toHaveBeenCalled();
    });

    it('throws NoteNotFoundError for nonexistent note', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute({ id: 'nonexistent' })).rejects.toThrow(NoteNotFoundError);
    });
  });

  describe('ToggleArchiveUseCase', () => {
    let noteRepo: INoteRepository;
    let eventPublisher: IEventPublisher;
    let useCase: ToggleArchiveUseCase;

    beforeEach(() => {
      noteRepo = createMockNoteRepository();
      eventPublisher = createMockEventPublisher();
      useCase = new ToggleArchiveUseCase(noteRepo, eventPublisher);
    });

    it('toggles archived status', async () => {
      const noteProps = createNoteProps({ isArchived: false });
      vi.mocked(noteRepo.findById).mockResolvedValue(noteProps);
      vi.mocked(noteRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({ id: 'note-1' });

      expect(result.note.isArchived).toBe(true);
      expect(noteRepo.save).toHaveBeenCalled();
    });

    it('throws NoteNotFoundError for nonexistent note', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute({ id: 'nonexistent' })).rejects.toThrow(NoteNotFoundError);
    });
  });

  describe('ListNotesUseCase', () => {
    let noteRepo: INoteRepository;
    let workspaceRepo: IWorkspaceRepository;
    let useCase: ListNotesUseCase;

    beforeEach(() => {
      noteRepo = createMockNoteRepository();
      workspaceRepo = createMockWorkspaceRepository();
      useCase = new ListNotesUseCase(noteRepo, workspaceRepo);
    });

    it('lists all notes without filter', async () => {
      const notes = [createNoteProps(), createNoteProps({ id: 'note-2' })];
      vi.mocked(noteRepo.findAll).mockResolvedValue(notes);
      vi.mocked(noteRepo.count).mockResolvedValue(2);

      const result = await useCase.execute({});

      expect(result.notes).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('filters favorites', async () => {
      const notes = [createNoteProps({ isFavorite: true })];
      vi.mocked(noteRepo.findFavorites).mockResolvedValue(notes);
      vi.mocked(noteRepo.count).mockResolvedValue(1);

      const result = await useCase.execute({ filter: 'favorites' });

      expect(noteRepo.findFavorites).toHaveBeenCalled();
      expect(result.notes).toHaveLength(1);
    });

    it('filters pinned', async () => {
      const notes = [createNoteProps({ isPinned: true })];
      vi.mocked(noteRepo.findPinned).mockResolvedValue(notes);
      vi.mocked(noteRepo.count).mockResolvedValue(1);

      const result = await useCase.execute({ filter: 'pinned' });

      expect(noteRepo.findPinned).toHaveBeenCalled();
      expect(result.notes).toHaveLength(1);
    });

    it('filters archived', async () => {
      const notes = [createNoteProps({ isArchived: true })];
      vi.mocked(noteRepo.findArchived).mockResolvedValue(notes);
      vi.mocked(noteRepo.count).mockResolvedValue(1);

      const result = await useCase.execute({ filter: 'archived' });

      expect(noteRepo.findArchived).toHaveBeenCalled();
      expect(result.notes).toHaveLength(1);
    });

    it('filters deleted (trash)', async () => {
      const notes = [createNoteProps({ isDeleted: true })];
      vi.mocked(noteRepo.findDeleted).mockResolvedValue(notes);
      vi.mocked(noteRepo.count).mockResolvedValue(1);

      const result = await useCase.execute({ filter: 'trash' });

      expect(noteRepo.findDeleted).toHaveBeenCalled();
      expect(result.notes).toHaveLength(1);
    });
  });
});
