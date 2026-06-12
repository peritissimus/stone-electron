import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStatusReportUseCases } from '../../../../src/main/application/usecases/statusReport';
import { MeetingRecordingEntity, type MeetingRecordingProps } from '../../../../src/main/domain/entities/MeetingRecording';
import type { NoteProps } from '../../../../src/main/domain/entities/Note';
import type { WorkspaceProps } from '../../../../src/main/domain/entities/Workspace';
import type { IJournalUseCases } from '../../../../src/main/domain/ports/in/IJournalUseCases';
import type { IStatusReportUseCases } from '../../../../src/main/domain/ports/in/IStatusReportUseCases';
import type { ITaskUseCases, TaskItem } from '../../../../src/main/domain/ports/in/ITaskUseCases';
import type { IMeetingRecordingRepository } from '../../../../src/main/domain/ports/out/IMeetingRecordingRepository';
import type { INoteRepository } from '../../../../src/main/domain/ports/out/INoteRepository';
import type { ITextGenerator } from '../../../../src/main/domain/ports/out/ITextGenerator';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';

const NOW = new Date(2026, 3, 21, 14, 0, 0);

function createMockNoteRepository(): INoteRepository {
  return {
    findRecentlyUpdated: vi.fn(),
  } as unknown as INoteRepository;
}

function createMockWorkspaceRepository(): IWorkspaceRepository {
  return {
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

function createMockTextGenerator(): ITextGenerator {
  return {
    generateAnswer: vi.fn(),
    generateMarkdown: vi.fn().mockResolvedValue({ text: '  ## Report\n\n- shipped work  ' }),
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

function recording(overrides: Partial<MeetingRecordingProps> = {}): MeetingRecordingEntity {
  return MeetingRecordingEntity.fromPersistence({
    id: 'rec-1',
    workspaceId: 'ws-1',
    title: 'Planning',
    status: 'ready',
    audioPath: null,
    durationMs: 60_000,
    transcriptText: 'Transcript',
    transcriptSegments: [],
    summary: '- Agreed next steps',
    promptUsed: 'prompt',
    journalDate: null,
    error: null,
    createdAt: new Date('2026-04-20T10:00:00'),
    updatedAt: new Date('2026-04-20T10:30:00'),
    ...overrides,
  });
}

function task(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: 'task-1',
    noteId: 'note-1',
    noteTitle: 'Release',
    notePath: 'Release.md',
    text: 'Ship release',
    state: 'done',
    checked: true,
    lineNumber: 12,
    createdAt: new Date('2026-04-19T09:00:00'),
    updatedAt: new Date('2026-04-20T11:00:00'),
    ...overrides,
  };
}

function note(overrides: Partial<NoteProps> = {}): NoteProps {
  return {
    id: 'note-1',
    title: 'Release plan',
    filePath: 'Release.md',
    notebookId: null,
    workspaceId: 'ws-1',
    isFavorite: false,
    isPinned: false,
    isArchived: false,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date('2026-04-01T00:00:00'),
    updatedAt: new Date('2026-04-20T16:00:00'),
    ...overrides,
  };
}

describe('StatusReportUseCases', () => {
  let noteRepository: INoteRepository;
  let workspaceRepository: IWorkspaceRepository;
  let meetingRepository: IMeetingRecordingRepository;
  let journalUseCases: IJournalUseCases;
  let taskUseCases: ITaskUseCases;
  let textGenerator: ITextGenerator;
  let useCases: IStatusReportUseCases;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    noteRepository = createMockNoteRepository();
    workspaceRepository = createMockWorkspaceRepository();
    meetingRepository = createMockMeetingRepository();
    journalUseCases = createMockJournalUseCases();
    taskUseCases = createMockTaskUseCases();
    textGenerator = createMockTextGenerator();
    useCases = createStatusReportUseCases({
      noteRepository,
      workspaceRepository,
      meetingRepository,
      journalUseCases,
      taskUseCases,
      textGenerator,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds an evidence packet and trims the generated report', async () => {
    vi.mocked(journalUseCases.listRange).mockResolvedValue({
      entries: [
        { date: '2026-04-19', noteId: 'j1', exists: true, content: 'Started release work' },
        { date: '2026-04-18', noteId: 'old', exists: true, content: 'Too old' },
      ],
    });
    vi.mocked(meetingRepository.list).mockResolvedValue({
      recordings: [
        recording(),
        recording({ id: 'future', createdAt: new Date('2026-04-22T10:00:00') }),
      ],
      nextCursor: null,
    });
    vi.mocked(taskUseCases.getAllTasks.execute).mockResolvedValue([
      task(),
      task({ id: 'open', checked: false, state: 'todo' }),
    ]);
    vi.mocked(noteRepository.findRecentlyUpdated).mockResolvedValue([
      note(),
      note({ id: 'deleted', isDeleted: true }),
    ]);

    const result = await useCases.generate.execute({
      workspaceId: 'ws-1',
      windowDays: 3,
      promptTemplate: 'Write a report from:\n{{evidence}}',
    });

    expect(journalUseCases.listRange).toHaveBeenCalledWith({ limit: 3, workspaceId: 'ws-1' });
    expect(meetingRepository.list).toHaveBeenCalledWith({ workspaceId: 'ws-1', limit: 200 });
    expect(noteRepository.findRecentlyUpdated).toHaveBeenCalledWith(80, 'ws-1');
    expect(textGenerator.generateMarkdown).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Started release work'),
        system: expect.stringContaining('Output the result directly'),
      }),
    );
    const prompt = vi.mocked(textGenerator.generateMarkdown).mock.calls[0][0].prompt;
    expect(prompt).toContain('Planning');
    expect(prompt).toContain('Ship release');
    expect(prompt).toContain('Release plan');
    expect(prompt).not.toContain('Too old');
    expect(result).toEqual({
      windowStart: '2026-04-19',
      windowEnd: '2026-04-21',
      evidence: {
        journalEntries: 1,
        meetings: 1,
        completedTasks: 1,
        modifiedNotes: 1,
      },
      report: '## Report\n\n- shipped work',
    });
  });

  it('uses active workspace and degrades missing evidence sections to empty', async () => {
    vi.mocked(workspaceRepository.findActive).mockResolvedValue(workspace());
    vi.mocked(journalUseCases.listRange).mockRejectedValue(new Error('journal failed'));
    vi.mocked(meetingRepository.list).mockRejectedValue(new Error('meetings failed'));
    vi.mocked(taskUseCases.getAllTasks.execute).mockRejectedValue(new Error('tasks failed'));
    vi.mocked(noteRepository.findRecentlyUpdated).mockRejectedValue(new Error('notes failed'));

    const result = await useCases.generate.execute();

    expect(result.evidence).toEqual({
      journalEntries: 0,
      meetings: 0,
      completedTasks: 0,
      modifiedNotes: 0,
    });
    expect(textGenerator.generateMarkdown).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('(none in window)'),
      }),
    );
  });

  it('throws when no workspace can be resolved', async () => {
    vi.mocked(workspaceRepository.findActive).mockResolvedValue(null);

    await expect(useCases.generate.execute()).rejects.toThrow('No active workspace');
  });
});
