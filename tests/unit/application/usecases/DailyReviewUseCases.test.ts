import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDailyReviewUseCases } from '../../../../src/main/application/usecases/dailyReview';
import { MeetingRecordingEntity } from '../../../../src/main/domain/entities/MeetingRecording';
import type { NoteProps } from '../../../../src/main/domain/entities/Note';
import type { WorkspaceProps } from '../../../../src/main/domain/entities/Workspace';
import type { IJournalUseCases } from '../../../../src/main/domain/ports/in/IJournalUseCases';
import type { ITaskUseCases, TaskItem } from '../../../../src/main/domain/ports/in/ITaskUseCases';
import type { IAppConfigRepository } from '../../../../src/main/domain/ports/out/IAppConfigRepository';
import type { IMeetingRecordingRepository } from '../../../../src/main/domain/ports/out/IMeetingRecordingRepository';
import type { INoteRepository } from '../../../../src/main/domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';
import { DEFAULT_APP_CONFIG } from '../../../../src/shared/types/settings';

function createMockNoteRepository(): INoteRepository {
  return {
    findAll: vi.fn(),
    findRecentlyUpdated: vi.fn(),
  } as unknown as INoteRepository;
}

function createMockWorkspaceRepository(): IWorkspaceRepository {
  return {
    findById: vi.fn(),
    findActive: vi.fn(),
  } as unknown as IWorkspaceRepository;
}

function createMockMeetingRepository(): IMeetingRecordingRepository {
  return {
    list: vi.fn(),
  } as unknown as IMeetingRecordingRepository;
}

function createMockJournalUseCases(): IJournalUseCases {
  return {
    openOrCreateForDate: vi.fn(),
    listRange: vi.fn(),
  };
}

function createMockTaskUseCases(): ITaskUseCases {
  return {
    getAllTasks: { execute: vi.fn() },
    getNoteTasks: { execute: vi.fn() },
    updateTaskState: { execute: vi.fn() },
    toggleTask: { execute: vi.fn() },
  };
}

function createMockAppConfigRepository(): IAppConfigRepository {
  return {
    get: vi.fn().mockResolvedValue(DEFAULT_APP_CONFIG),
    set: vi.fn(),
    update: vi.fn(),
  } as unknown as IAppConfigRepository;
}

function workspace(overrides: Partial<WorkspaceProps> = {}): WorkspaceProps {
  return {
    id: 'ws-1',
    name: 'Workspace',
    folderPath: '/workspace',
    isActive: true,
    createdAt: new Date('2025-01-01T00:00:00'),
    lastAccessedAt: new Date('2025-01-02T00:00:00'),
    ...overrides,
  };
}

function note(overrides: Partial<NoteProps> = {}): NoteProps {
  return {
    id: 'note-1',
    title: 'Note',
    filePath: 'Notes/note.md',
    notebookId: null,
    workspaceId: 'ws-1',
    isFavorite: false,
    isPinned: false,
    isArchived: false,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date('2026-04-20T10:00:00'),
    updatedAt: new Date('2026-04-20T10:00:00'),
    ...overrides,
  };
}

function task(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: 'task-1',
    noteId: 'note-1',
    noteTitle: 'Note',
    notePath: 'Notes/note.md',
    text: 'Follow up',
    state: 'todo',
    checked: false,
    lineNumber: 3,
    createdAt: new Date('2026-04-21T08:00:00'),
    updatedAt: new Date('2026-04-21T08:30:00'),
    ...overrides,
  };
}

function recording(overrides: Parameters<typeof MeetingRecordingEntity.fromPersistence>[0]) {
  return MeetingRecordingEntity.fromPersistence(overrides);
}

describe('DailyReviewUseCases', () => {
  let noteRepository: INoteRepository;
  let workspaceRepository: IWorkspaceRepository;
  let meetingRepository: IMeetingRecordingRepository;
  let journalUseCases: IJournalUseCases;
  let taskUseCases: ITaskUseCases;
  let appConfigRepository: IAppConfigRepository;

  beforeEach(() => {
    noteRepository = createMockNoteRepository();
    workspaceRepository = createMockWorkspaceRepository();
    meetingRepository = createMockMeetingRepository();
    journalUseCases = createMockJournalUseCases();
    taskUseCases = createMockTaskUseCases();
    appConfigRepository = createMockAppConfigRepository();
  });

  function useCases() {
    return createDailyReviewUseCases({
      noteRepository,
      workspaceRepository,
      meetingRepository,
      journalUseCases,
      taskUseCases,
      appConfigRepository,
      textGenerator: { generateMarkdown: vi.fn(async () => ({ text: '- summary' })) } as never,
      appendToJournal: vi.fn(async () => ({ noteId: 'journal-1', appended: true })),
    });
  }

  it('returns an empty snapshot when no active workspace exists', async () => {
    vi.mocked(workspaceRepository.findActive).mockResolvedValue(null);

    const result = await useCases().getDailyReview.execute({ date: '2026-04-21' });

    expect(result).toEqual({
      date: '2026-04-21',
      todayJournal: { date: '2026-04-21', noteId: null, contentPreview: null },
      todayMeetings: [],
      openTasks: [],
      recentNotes: [],
      onThisDay: [],
    });
    expect(journalUseCases.listRange).not.toHaveBeenCalled();
  });

  it('composes the day snapshot and filters each section', async () => {
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    vi.mocked(journalUseCases.listRange).mockResolvedValue({
      entries: [
        {
          date: '2026-04-21',
          noteId: 'journal-1',
          exists: true,
          content: '# 2026-04-21\n\nWorked on release notes.\n\n\nCaptured follow-up.',
        },
      ],
    });

    vi.mocked(meetingRepository.list).mockResolvedValue({
      recordings: [
        recording({
          id: 'rec-today',
          workspaceId: 'ws-1',
          title: 'Planning',
          status: 'ready',
          audioPath: null,
          durationMs: 120_000,
          transcriptText: 'Transcript',
          transcriptSegments: [],
          summary: '- Decided scope',
          promptUsed: 'prompt',
          journalDate: '2026-04-21',
          error: null,
          createdAt: new Date('2026-04-21T09:30:00'),
          updatedAt: new Date('2026-04-21T10:00:00'),
        }),
        recording({
          id: 'rec-yesterday',
          workspaceId: 'ws-1',
          title: 'Old',
          status: 'ready',
          audioPath: null,
          durationMs: 60_000,
          transcriptText: null,
          transcriptSegments: [],
          summary: null,
          promptUsed: null,
          journalDate: null,
          error: null,
          createdAt: new Date('2026-04-20T23:59:59'),
          updatedAt: new Date('2026-04-20T23:59:59'),
        }),
      ],
      nextCursor: null,
    });

    vi.mocked(taskUseCases.getAllTasks.execute).mockResolvedValue([
      task({ id: 'todo', checked: false, state: 'todo' }),
      task({ id: 'done', checked: true, state: 'done' }),
      task({ id: 'canceled', checked: false, state: 'canceled' }),
    ]);

    vi.mocked(noteRepository.findRecentlyUpdated).mockResolvedValue([
      note({ id: 'recent', filePath: 'Notes/recent.md', updatedAt: new Date('2026-04-20T12:30:00') }),
      note({ id: 'journal', filePath: 'Journal/2026-04-21.md', updatedAt: new Date('2026-04-21T08:00:00') }),
      note({ id: 'old-edit', filePath: 'Notes/old.md', updatedAt: new Date('2026-04-19T23:59:59') }),
    ]);

    vi.mocked(noteRepository.findAll).mockResolvedValue([
      note({
        id: 'anniversary',
        title: 'Launch notes',
        createdAt: new Date('2024-04-21T14:00:00'),
      }),
      note({
        id: 'same-year',
        title: 'Today',
        createdAt: new Date('2026-04-21T14:00:00'),
      }),
      note({
        id: 'deleted',
        isDeleted: true,
        createdAt: new Date('2023-04-21T14:00:00'),
      }),
    ]);

    const result = await useCases().getDailyReview.execute({
      workspaceId: 'ws-1',
      date: '2026-04-21',
    });

    expect(journalUseCases.listRange).toHaveBeenCalledWith({ limit: 1, workspaceId: 'ws-1' });
    expect(result.todayJournal).toEqual({
      date: '2026-04-21',
      noteId: 'journal-1',
      contentPreview: 'Worked on release notes.\n\nCaptured follow-up.',
    });
    expect(result.todayMeetings.map((m) => m.id)).toEqual(['rec-today']);
    expect(result.todayMeetings[0].inJournal).toBe(true);
    expect(result.openTasks.map((t) => t.id)).toEqual(['todo']);
    expect(result.recentNotes.map((n) => n.id)).toEqual(['recent']);
    expect(result.onThisDay.map((entry) => [entry.note.id, entry.yearsAgo])).toEqual([
      ['anniversary', 2],
    ]);
  });

  it('isolates section failures instead of failing the page', async () => {
    vi.mocked(workspaceRepository.findActive).mockResolvedValue(workspace());
    vi.mocked(journalUseCases.listRange).mockRejectedValue(new Error('journal down'));
    vi.mocked(meetingRepository.list).mockRejectedValue(new Error('meetings down'));
    vi.mocked(taskUseCases.getAllTasks.execute).mockRejectedValue(new Error('tasks down'));
    vi.mocked(noteRepository.findRecentlyUpdated).mockRejectedValue(new Error('recent down'));
    vi.mocked(noteRepository.findAll).mockRejectedValue(new Error('all down'));

    const result = await useCases().getDailyReview.execute({ date: '2026-04-21' });

    expect(result.todayJournal).toEqual({
      date: '2026-04-21',
      noteId: null,
      contentPreview: null,
    });
    expect(result.todayMeetings).toEqual([]);
    expect(result.openTasks).toEqual([]);
    expect(result.recentNotes).toEqual([]);
    expect(result.onThisDay).toEqual([]);
  });
});
