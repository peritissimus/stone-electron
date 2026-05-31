/**
 * GetDailyReviewUseCase — composes today's snapshot from existing
 * sources (no new persistence). Each section runs in parallel and is
 * try/catch-isolated so one slow / failed query doesn't kill the page.
 *
 * Sources composed:
 *   - Today's journal entry — IJournalUseCases.listRange(1)
 *   - Today's meetings      — IMeetingRecordingRepository.list, filtered
 *                             to createdAt within [start, end] of today
 *   - Open tasks            — ITaskUseCases.getAllTasks, filtered to
 *                             checked === false
 *   - Recent notes          — INoteRepository.findRecentlyUpdated, filtered
 *                             to the last 24h
 *   - On this day           — INoteRepository.findAll, filtered to notes
 *                             whose createdAt matches today's MM-DD in a
 *                             prior year
 */

import type {
  DailyReviewMeetingSummary,
  DailyReviewOnThisDayEntry,
  DailyReviewSnapshot,
  DailyReviewTodayJournal,
  GetDailyReviewRequest,
  IGetDailyReviewUseCase,
  IJournalUseCases,
  IMeetingRecordingRepository,
  INoteRepository,
  ITaskUseCases,
  IWorkspaceRepository,
  NoteProps,
  TaskItem,
} from '../../../domain';

const PREVIEW_CHARS = 240;
const RECENT_NOTES_LIMIT = 8;
const RECENT_NOTES_WINDOW_MS = 24 * 60 * 60 * 1000;
const ON_THIS_DAY_LIMIT = 5;

export interface GetDailyReviewUseCaseDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  meetingRepository: IMeetingRecordingRepository;
  journalUseCases: IJournalUseCases;
  taskUseCases: ITaskUseCases;
}

export class GetDailyReviewUseCase implements IGetDailyReviewUseCase {
  constructor(private readonly deps: GetDailyReviewUseCaseDeps) {}

  async execute(request: GetDailyReviewRequest = {}): Promise<DailyReviewSnapshot> {
    const workspaceId =
      request.workspaceId ?? (await this.deps.workspaceRepository.findActive())?.id;
    const date = request.date ?? todayIso();

    if (!workspaceId) {
      return emptySnapshot(date);
    }

    const target = parseIso(date);
    const dayStart = startOfDay(target);
    const dayEnd = endOfDay(target);

    const [todayJournal, todayMeetings, openTasks, recentNotes, onThisDay] = await Promise.all([
      this.loadTodayJournal(workspaceId, date),
      this.loadTodayMeetings(workspaceId, dayStart, dayEnd),
      this.loadOpenTasks(),
      this.loadRecentNotes(workspaceId, target),
      this.loadOnThisDay(workspaceId, target),
    ]);

    return { date, todayJournal, todayMeetings, openTasks, recentNotes, onThisDay };
  }

  private async loadTodayJournal(
    workspaceId: string,
    date: string,
  ): Promise<DailyReviewTodayJournal> {
    try {
      const { entries } = await this.deps.journalUseCases.listRange({
        limit: 1,
        workspaceId,
      });
      const entry = entries.find((e) => e.date === date) ?? entries[0] ?? null;
      if (!entry) return { date, noteId: null, contentPreview: null };
      return {
        date: entry.date,
        noteId: entry.noteId,
        contentPreview: entry.content ? trimPreview(entry.content) : null,
      };
    } catch {
      return { date, noteId: null, contentPreview: null };
    }
  }

  private async loadTodayMeetings(
    workspaceId: string,
    dayStart: Date,
    dayEnd: Date,
  ): Promise<DailyReviewMeetingSummary[]> {
    try {
      const { recordings } = await this.deps.meetingRepository.list({
        workspaceId,
        // Page size large enough to cover the busiest realistic day.
        limit: 50,
      });
      return recordings
        .filter((r) => r.createdAt >= dayStart && r.createdAt <= dayEnd)
        .map(
          (r): DailyReviewMeetingSummary => ({
            id: r.id,
            title: r.title,
            status: r.status,
            durationMs: r.durationMs,
            summary: r.summary,
            createdAt: r.createdAt,
            inJournal: r.journalDate !== null,
          }),
        );
    } catch {
      return [];
    }
  }

  private async loadOpenTasks(): Promise<TaskItem[]> {
    try {
      const all = await this.deps.taskUseCases.getAllTasks.execute();
      return all.filter((task) => !task.checked && task.state !== 'canceled');
    } catch {
      return [];
    }
  }

  private async loadRecentNotes(workspaceId: string, now: Date): Promise<NoteProps[]> {
    try {
      const all = await this.deps.noteRepository.findRecentlyUpdated(
        RECENT_NOTES_LIMIT * 4,
        workspaceId,
      );
      const cutoff = new Date(now.getTime() - RECENT_NOTES_WINDOW_MS);
      return all.filter((note) => note.updatedAt >= cutoff).slice(0, RECENT_NOTES_LIMIT);
    } catch {
      return [];
    }
  }

  private async loadOnThisDay(
    workspaceId: string,
    target: Date,
  ): Promise<DailyReviewOnThisDayEntry[]> {
    try {
      const all = await this.deps.noteRepository.findAll({ workspaceId });
      const month = target.getMonth();
      const day = target.getDate();
      const thisYear = target.getFullYear();

      return all
        .filter((note) => {
          if (note.isDeleted) return false;
          const created = note.createdAt;
          return (
            created.getMonth() === month &&
            created.getDate() === day &&
            created.getFullYear() < thisYear
          );
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, ON_THIS_DAY_LIMIT)
        .map((note) => ({
          yearsAgo: thisYear - note.createdAt.getFullYear(),
          date: note.createdAt,
          note,
        }));
    } catch {
      return [];
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function emptySnapshot(date: string): DailyReviewSnapshot {
  return {
    date,
    todayJournal: { date, noteId: null, contentPreview: null },
    todayMeetings: [],
    openTasks: [],
    recentNotes: [],
    onThisDay: [],
  };
}

function todayIso(): string {
  return formatIso(new Date());
}

function formatIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIso(date: string): Date {
  // YYYY-MM-DD interpreted in local time. `new Date('YYYY-MM-DD')` would
  // parse as UTC midnight, which can land on the previous calendar day
  // in negative-UTC-offset timezones.
  const [y, m, d] = date.split('-').map((part) => Number(part));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function trimPreview(content: string): string {
  const stripped = content
    .replaceAll(/^#{1,6}\s+.*$/gm, '')
    .replaceAll(/^\s+|\s+$/g, '')
    .replaceAll(/\n{3,}/g, '\n\n');
  if (!stripped) return '';
  if (stripped.length <= PREVIEW_CHARS) return stripped;
  return `${stripped.slice(0, PREVIEW_CHARS).trim()}…`;
}
