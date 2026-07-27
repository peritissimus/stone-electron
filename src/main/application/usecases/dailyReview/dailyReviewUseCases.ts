import { Effect, Layer } from 'effect';
import {
  AppConfigRepositoryPort,
  CalendarSourcePort,
  DailyReviewUseCasesPort,
  ExternalSourceRegistryPort,
  JournalUseCasesPort,
  MeetingRecordingRepositoryPort,
  NoteRepositoryPort,
  QuickCaptureUseCasesPort,
  TaskUseCasesPort,
  TextGeneratorPort,
  WorkspaceRepositoryPort,
  type DailyReviewMeetingSummary,
  type DailyReviewOnThisDayEntry,
  type DailyReviewSnapshot,
  type DailyReviewTodayJournal,
  type GetDailyReviewRequest,
  type IDailyReviewUseCases,
  type NoteProps,
  type TaskItem,
} from '../../../domain';

const PREVIEW_CHARS = 240;
const RECENT_NOTES_LIMIT = 8;
const RECENT_NOTES_WINDOW_MS = 24 * 60 * 60 * 1000;
const ON_THIS_DAY_LIMIT = 5;
const SYSTEM_PROMPT =
  'You write a brief daily briefing from the structured notes below. Lead with a one-line gist, then only the sections that have content (e.g. Focus, Meetings, Tasks, Inbox). Be concrete and skimmable; no preamble, no invented details. Output markdown only.';

export const DailyReviewUseCasesLive = Layer.effect(
  DailyReviewUseCasesPort,
  Effect.gen(function* () {
    const noteRepository = yield* NoteRepositoryPort;
    const workspaceRepository = yield* WorkspaceRepositoryPort;
    const meetingRepository = yield* MeetingRecordingRepositoryPort;
    const journalUseCases = yield* JournalUseCasesPort;
    const taskUseCases = yield* TaskUseCasesPort;
    const appConfigRepository = yield* AppConfigRepositoryPort;
    const textGenerator = yield* TextGeneratorPort;
    const quickCapture = yield* QuickCaptureUseCasesPort;
    const calendarSource = yield* CalendarSourcePort;
    const externalSourceRegistry = yield* ExternalSourceRegistryPort;

    const getDailyReview = (
      request: GetDailyReviewRequest = {},
    ): Effect.Effect<DailyReviewSnapshot, Error> =>
      Effect.gen(function* () {
        const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
        const workspaceId =
          request.workspaceId ?? (yield* workspaceRepository.findActive())?.id;
        const date = request.date ?? formatIso(new Date(now));
        if (!workspaceId) return emptySnapshot(date);

        const target = parseIso(date);
        const dayStart = startOfDay(target);
        const dayEnd = endOfDay(target);
        const [todayJournal, todayMeetings, openTasks, recentNotes, onThisDay] =
          yield* Effect.all(
            [
              loadTodayJournal(workspaceId, date),
              loadTodayMeetings(workspaceId, dayStart, dayEnd),
              loadOpenTasks(),
              loadRecentNotes(workspaceId, target),
              loadOnThisDay(workspaceId, target),
            ],
            { concurrency: 'unbounded' },
          );

        return yield* externalSourceRegistry.mergeInto({
          date,
          todayJournal,
          todayMeetings,
          openTasks,
          recentNotes,
          onThisDay,
        });
      });

    const loadTodayJournal = (
      workspaceId: string,
      date: string,
    ): Effect.Effect<DailyReviewTodayJournal, never> =>
      journalUseCases
        .listRange({ limit: 1, workspaceId })
        .pipe(
          Effect.map(({ entries }) => {
            const entry =
              entries.find((candidate) => candidate.date === date) ??
              entries[0] ??
              null;
            if (!entry) {
              return { date, exists: false, noteId: null, contentPreview: null };
            }
            return {
              date: entry.date,
              exists: entry.exists,
              noteId: entry.noteId,
              contentPreview: entry.content ? trimPreview(entry.content) : null,
            };
          }),
          Effect.catchAll(() =>
            Effect.succeed({
              date,
              exists: false,
              noteId: null,
              contentPreview: null,
            }),
          ),
        );

    const loadTodayMeetings = (
      workspaceId: string,
      dayStart: Date,
      dayEnd: Date,
    ): Effect.Effect<DailyReviewMeetingSummary[], never> =>
      meetingRepository
        .list({ workspaceId, limit: 50 })
        .pipe(
          Effect.map(({ recordings }) =>
            recordings
              .filter(
                (recording) =>
                  recording.createdAt >= dayStart &&
                  recording.createdAt <= dayEnd,
              )
              .map((recording) => ({
                id: recording.id,
                title: recording.title,
                status: recording.status,
                durationMs: recording.durationMs,
                summary: recording.summary,
                createdAt: recording.createdAt,
                inJournal: recording.journalDate !== null,
              })),
          ),
          Effect.catchAll(() => Effect.succeed([])),
        );

    const loadOpenTasks = (): Effect.Effect<TaskItem[], never> =>
      taskUseCases.getAllTasks
        .execute()
        .pipe(
          Effect.map((tasks) =>
            tasks.filter(
              (task) => !task.checked && task.state !== 'canceled',
            ),
          ),
          Effect.catchAll(() => Effect.succeed([])),
        );

    const loadRecentNotes = (
      workspaceId: string,
      target: Date,
    ): Effect.Effect<NoteProps[], never> =>
      Effect.all(
        [
          noteRepository.findRecentlyUpdated(
            RECENT_NOTES_LIMIT * 4,
            workspaceId,
          ),
          appConfigRepository.get(),
        ],
        { concurrency: 2 },
      ).pipe(
        Effect.map(([notes, config]) => {
          const cutoff = new Date(
            target.getTime() - RECENT_NOTES_WINDOW_MS,
          );
          const journalPrefix = `${config.notes.locationPolicy.journalFolder}/`;
          return notes
            .filter(
              (note) =>
                note.updatedAt >= cutoff &&
                !note.filePath?.startsWith(journalPrefix),
            )
            .slice(0, RECENT_NOTES_LIMIT);
        }),
        Effect.catchAll(() => Effect.succeed([])),
      );

    const loadOnThisDay = (
      workspaceId: string,
      target: Date,
    ): Effect.Effect<DailyReviewOnThisDayEntry[], never> =>
      noteRepository.findAll({ workspaceId }).pipe(
        Effect.map((notes) => {
          const month = target.getMonth();
          const day = target.getDate();
          const thisYear = target.getFullYear();
          return notes
            .filter((note) => {
              if (note.isDeleted) return false;
              const created = note.createdAt;
              return (
                created.getMonth() === month &&
                created.getDate() === day &&
                created.getFullYear() < thisYear
              );
            })
            .sort(
              (left, right) =>
                right.createdAt.getTime() - left.createdAt.getTime(),
            )
            .slice(0, ON_THIS_DAY_LIMIT)
            .map((note) => ({
              yearsAgo: thisYear - note.createdAt.getFullYear(),
              date: note.createdAt,
              note,
            }));
        }),
        Effect.catchAll(() => Effect.succeed([])),
      );

    const service: IDailyReviewUseCases = {
      getDailyReview: { execute: getDailyReview },
      listCalendars: {
        execute: () =>
          calendarSource.listCalendars().pipe(
            Effect.map((result) => ({
              status: result.status,
              calendars: result.data,
              ...(result.message ? { message: result.message } : {}),
            })),
            Effect.catchAll(() =>
              Effect.succeed({
                status: 'error' as const,
                calendars: [],
                message: 'Could not list calendars.',
              }),
            ),
          ),
      },
      // Both of these re-read the day after loading, because the registry
      // merges from its own cache: reading after the load is what makes the
      // fresh data visible. Doing it here rather than leaving it to the caller
      // is the difference between one request and two, and it keeps the
      // ordering a fact of this module instead of a convention the caller has
      // to know.
      loadIntegration: {
        execute: (request) =>
          Effect.gen(function* () {
            const result = yield* externalSourceRegistry.load(request.source, {
              date: request.date,
            });
            const snapshot = yield* getDailyReview({ date: request.date });
            return { result, snapshot };
          }),
      },
      loadIntegrations: {
        execute: (request = {}) =>
          Effect.gen(function* () {
            const results = yield* externalSourceRegistry.loadAll({ date: request.date });
            const snapshot = yield* getDailyReview({ date: request.date });
            return { results, snapshot };
          }),
      },
      summarizeDailyReview: {
        execute: (request = {}) =>
          Effect.gen(function* () {
            const snapshot = yield* getDailyReview({
              workspaceId: request.workspaceId,
              date: request.date,
            });
            const generated = yield* textGenerator.generateMarkdown({
              prompt: buildPrompt(snapshot),
              system: SYSTEM_PROMPT,
            });
            const summary = generated.text.trim();
            let journalNoteId: string | null = null;
            if (request.saveToJournal && summary) {
              const appended = yield* quickCapture.appendToJournal(
                `## Daily summary\n\n${summary}`,
                request.workspaceId,
              );
              journalNoteId = appended.noteId;
            }
            return { summary, journalNoteId };
          }),
      },
    };
    return service;
  }),
);

function emptySnapshot(date: string): DailyReviewSnapshot {
  return {
    date,
    todayJournal: {
      date,
      exists: false,
      noteId: null,
      contentPreview: null,
    },
    todayMeetings: [],
    openTasks: [],
    recentNotes: [],
    onThisDay: [],
  };
}

function formatIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIso(date: string): Date {
  const [year, month, day] = date
    .split('-')
    .map((part) => Number(part));
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function startOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
}

function endOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
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

function buildPrompt(snapshot: DailyReviewSnapshot): string {
  const lines: string[] = [`Date: ${snapshot.date}`, ''];
  if (snapshot.todayJournal.contentPreview) {
    lines.push(
      '## Journal so far',
      snapshot.todayJournal.contentPreview,
      '',
    );
  }
  if (snapshot.calendarEvents?.length) {
    lines.push('## Calendar');
    for (const event of snapshot.calendarEvents) {
      const when = event.allDay
        ? 'all day'
        : `${formatTime(event.start)}–${formatTime(event.end)}`;
      lines.push(
        `- ${when} · ${event.title}${
          event.location ? ` (${event.location})` : ''
        }`,
      );
    }
    lines.push('');
  }
  if (snapshot.todayMeetings.length) {
    lines.push('## Meetings');
    for (const meeting of snapshot.todayMeetings) {
      lines.push(
        `- ${meeting.title}${
          meeting.summary ? `: ${meeting.summary}` : ''
        }`,
      );
    }
    lines.push('');
  }
  if (snapshot.openTasks.length) {
    lines.push('## Open tasks');
    for (const task of snapshot.openTasks) {
      lines.push(`- [${task.state}] ${task.text}`);
    }
    lines.push('');
  }
  if (snapshot.linearIssues?.length) {
    lines.push('## Linear');
    for (const issue of snapshot.linearIssues) {
      lines.push(
        `- ${issue.identifier} ${issue.title} (${issue.state}${
          issue.dueDate ? `, due ${issue.dueDate}` : ''
        })`,
      );
    }
    lines.push('');
  }
  if (snapshot.mailUnreadCount || snapshot.mailMessages?.length) {
    lines.push('## Unread mail');
    if (snapshot.mailUnreadCount) {
      lines.push(`- ${snapshot.mailUnreadCount} unread messages`);
    }
    for (const message of snapshot.mailMessages ?? []) {
      lines.push(`- ${message.subject} — ${message.sender}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}
