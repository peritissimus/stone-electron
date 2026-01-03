/**
 * TaskService Tests
 *
 * Covers task extraction, validation, and state updates.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const loggerSpies = vi.hoisted(() => ({
  info: vi.fn(),
}));

vi.mock('../../src/main/utils/logger', () => ({
  logger: loggerSpies,
}));

const writeFileSpy = vi.hoisted(() => vi.fn());

vi.mock('fs/promises', () => ({
  default: { writeFile: writeFileSpy },
  writeFile: writeFileSpy,
}));

const mockNoteRepo = vi.hoisted(() => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
}));

const mockWorkspaceRepo = vi.hoisted(() => ({
  findById: vi.fn(),
}));

const mockNoteService = vi.hoisted(() => ({
  getRawContent: vi.fn(),
}));

vi.mock('../../src/main/repositories', () => ({
  getRepositories: vi.fn(() => ({
    note: mockNoteRepo,
    workspace: mockWorkspaceRepo,
  })),
}));

vi.mock('../../src/main/services/NoteService', () => ({
  getNoteService: vi.fn(() => mockNoteService),
}));

import { createTaskService } from '../../src/main/services/TaskService';

describe('TaskService', () => {
  // Use factory function with mocked dependencies instead of singleton getter
  const taskService = createTaskService({
    noteRepository: mockNoteRepo as any,
    workspaceRepository: mockWorkspaceRepo as any,
    noteService: mockNoteService as any,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts todos for a specific note', async () => {
    mockNoteRepo.findById.mockResolvedValue({
      id: 'note-1',
      title: 'My Note',
      filePath: 'notes/note.md',
      workspaceId: 'ws',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockNoteService.getRawContent.mockResolvedValue(
      `
      TODO First item
      CANCELLED Old idea
      `,
    );

    const todos = await taskService.getTodosForNote('note-1');

    expect(todos).toHaveLength(2);
    expect(todos[0]).toMatchObject({ noteId: 'note-1', state: 'todo', text: 'First item' });
    expect(todos[1]).toMatchObject({ state: 'canceled', text: 'Old idea' });
  });

  it('updates task state and writes back to file', async () => {
    mockNoteService.getRawContent.mockResolvedValue(
      `TODO First
TODO Second task
`,
    );
    mockNoteRepo.findById.mockResolvedValue({
      id: 'note-1',
      title: 'Sample Note',
      filePath: 'notes/note.md',
      workspaceId: 'ws',
    });
    mockWorkspaceRepo.findById.mockResolvedValue({ folderPath: '/root' });

    await taskService.updateTaskState('note-1', 1, 'done');

    expect(writeFileSpy).toHaveBeenCalledWith(
      '/root/notes/note.md',
      expect.stringContaining('DONE'),
      'utf-8',
    );
    expect(writeFileSpy).toHaveBeenCalledWith(
      '/root/notes/note.md',
      expect.stringContaining('# Sample Note'),
      'utf-8',
    );
    expect(mockNoteRepo.update).toHaveBeenCalledWith('note-1', expect.objectContaining({ updatedAt: expect.any(Date) }));
  });
});
