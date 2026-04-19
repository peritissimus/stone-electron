/**
 * TaskUseCases Application Layer Tests
 *
 * Tests use case orchestration with mocked OUT ports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTaskUseCases } from '../../../../src/main/application/usecases/task';
import type { INoteRepository } from '../../../../src/main/domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../../src/main/domain/ports/out/IFileStorage';
import type { IMarkdownProcessor } from '../../../../src/main/domain/ports/out/IMarkdownProcessor';
import type { ITaskUseCases } from '../../../../src/main/domain/ports/in/ITaskUseCases';
import type { NoteProps } from '../../../../src/main/domain/entities/Note';
import type { WorkspaceProps } from '../../../../src/main/domain/entities/Workspace';

// Mock factories
function createMockNoteRepository(): INoteRepository {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  } as unknown as INoteRepository;
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
  } as unknown as IFileStorage;
}

function createMockMarkdownProcessor(): IMarkdownProcessor {
  return {
    htmlToMarkdown: vi.fn(),
    markdownToHtml: vi.fn(),
  } as unknown as IMarkdownProcessor;
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

describe('TaskUseCases', () => {
  let noteRepo: INoteRepository;
  let workspaceRepo: IWorkspaceRepository;
  let fileStorage: IFileStorage;
  let markdownProcessor: IMarkdownProcessor;
  let useCases: ITaskUseCases;

  beforeEach(() => {
    noteRepo = createMockNoteRepository();
    workspaceRepo = createMockWorkspaceRepository();
    fileStorage = createMockFileStorage();
    markdownProcessor = createMockMarkdownProcessor();
    useCases = createTaskUseCases({
      noteRepository: noteRepo,
      workspaceRepository: workspaceRepo,
      fileStorage,
      markdownProcessor,
    });
  });

  describe('getAllTasks', () => {
    it('returns tasks from all notes', async () => {
      const workspace = createWorkspaceProps();
      const note = createNoteProps();
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);
      vi.mocked(noteRepo.findAll).mockResolvedValue([note]);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.read).mockResolvedValue(
        '# Test\n\n- TODO Task 1\n- DONE Task 2\n- TODO Task 3',
      );

      const result = await useCases.getAllTasks.execute();

      expect(result).toHaveLength(3);
      expect(result[0].text).toBe('Task 1');
      expect(result[0].checked).toBe(false);
      expect(result[1].checked).toBe(true);
    });

    it('returns empty array when no active workspace', async () => {
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(null);

      const result = await useCases.getAllTasks.execute();

      expect(result).toHaveLength(0);
    });

    it('skips notes without file path', async () => {
      const workspace = createWorkspaceProps();
      const note = createNoteProps({ filePath: null });
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);
      vi.mocked(noteRepo.findAll).mockResolvedValue([note]);

      const result = await useCases.getAllTasks.execute();

      expect(result).toHaveLength(0);
    });

    it('skips notes with read errors', async () => {
      const workspace = createWorkspaceProps();
      const note = createNoteProps();
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);
      vi.mocked(noteRepo.findAll).mockResolvedValue([note]);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.read).mockRejectedValue(new Error('Read error'));

      const result = await useCases.getAllTasks.execute();

      expect(result).toHaveLength(0);
    });
  });

  describe('getNoteTasks', () => {
    it('returns tasks for specific note', async () => {
      const note = createNoteProps();
      const workspace = createWorkspaceProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.read).mockResolvedValue('# Test\n\n- TODO Task 1\n- DONE Done task');

      const result = await useCases.getNoteTasks.execute('note-1');

      expect(result).toHaveLength(2);
      expect(result[0].noteId).toBe('note-1');
    });

    it('throws error when note not found', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(useCases.getNoteTasks.execute('nonexistent')).rejects.toThrow(
        'Note not found: nonexistent',
      );
    });

    it('returns empty array when note has no file path', async () => {
      const note = createNoteProps({ filePath: null });
      vi.mocked(noteRepo.findById).mockResolvedValue(note);

      const result = await useCases.getNoteTasks.execute('note-1');

      expect(result).toHaveLength(0);
    });

    it('throws error when workspace not found', async () => {
      const note = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(null);

      await expect(useCases.getNoteTasks.execute('note-1')).rejects.toThrow(
        'Workspace not found: ws-1',
      );
    });

    it('returns empty array when file has no content', async () => {
      const note = createNoteProps();
      const workspace = createWorkspaceProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.read).mockResolvedValue(null);

      const result = await useCases.getNoteTasks.execute('note-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('updateTaskState', () => {
    it('updates task state in file', async () => {
      const note = createNoteProps();
      const workspace = createWorkspaceProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.read).mockResolvedValue('# Test\n\n- TODO Task 1');
      vi.mocked(fileStorage.write).mockResolvedValue(undefined);
      vi.mocked(noteRepo.save).mockResolvedValue(undefined);

      await useCases.updateTaskState.execute('note-1', 0, 'done');

      expect(fileStorage.write).toHaveBeenCalled();
      expect(noteRepo.save).toHaveBeenCalled();
    });

    it('throws error when note not found', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(useCases.updateTaskState.execute('nonexistent', 0, 'done')).rejects.toThrow(
        'Note not found: nonexistent',
      );
    });

    it('throws error when note has no file path', async () => {
      const note = createNoteProps({ filePath: null });
      vi.mocked(noteRepo.findById).mockResolvedValue(note);

      await expect(useCases.updateTaskState.execute('note-1', 0, 'done')).rejects.toThrow(
        'Note has no file path',
      );
    });

    it('throws error when file has no content', async () => {
      const note = createNoteProps();
      const workspace = createWorkspaceProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.read).mockResolvedValue(null);

      await expect(useCases.updateTaskState.execute('note-1', 0, 'done')).rejects.toThrow(
        'Could not read note content',
      );
    });
  });

  describe('toggleTask', () => {
    it('toggles task from todo to done', async () => {
      const note = createNoteProps();
      const workspace = createWorkspaceProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.read).mockResolvedValue('# Test\n\n- TODO Task 1');
      vi.mocked(fileStorage.write).mockResolvedValue(undefined);
      vi.mocked(noteRepo.save).mockResolvedValue(undefined);

      await useCases.toggleTask.execute('note-1', 0);

      expect(fileStorage.write).toHaveBeenCalled();
    });

    it('throws error when task not found', async () => {
      const note = createNoteProps();
      const workspace = createWorkspaceProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.read).mockResolvedValue('# Test\n\nNo tasks here');

      await expect(useCases.toggleTask.execute('note-1', 99)).rejects.toThrow(
        'Task at index 99 not found',
      );
    });
  });
});
