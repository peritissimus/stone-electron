import { Effect, Layer } from 'effect';
import {
  DEFAULT_STATUS_REPORT_PROMPT,
  JournalUseCasesPort,
  MeetingRecordingRepositoryPort,
  NoteRepositoryPort,
  StatusReportUseCasesPort,
  TaskUseCasesPort,
  TextGeneratorPort,
  WorkspaceRepositoryPort,
  type IStatusReportUseCases,
  formatJournalDate,
} from '../../../domain';

const DEFAULT_WINDOW_DAYS = 7;
const MAX_NOTE_TITLES = 20;
const MAX_MEETINGS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

interface EvidencePacket {
  windowStart: Date;
  windowEnd: Date;
  journalEntries: Array<{ date: string; content: string }>;
  meetings: Array<{ date: string; title: string; summary: string | null }>;
  completedTasks: Array<{
    noteTitle: string | null;
    text: string;
    updatedAt: Date;
  }>;
  modifiedNotes: Array<{ title: string; updatedAt: Date }>;
}


function renderEvidence(packet: EvidencePacket): string {
  const lines = [
    `Window: ${formatJournalDate(packet.windowStart)} to ${formatJournalDate(packet.windowEnd)}.`,
    '',
    '## Daily journal entries',
  ];
  if (packet.journalEntries.length === 0) {
    lines.push('(none in window)', '');
  } else {
    for (const entry of packet.journalEntries) {
      lines.push(`### ${entry.date}`, entry.content.trim(), '');
    }
  }
  if (packet.meetings.length > 0) {
    lines.push('## Meetings');
    for (const meeting of packet.meetings) {
      lines.push(
        `### ${meeting.date} — ${meeting.title}`,
        meeting.summary?.trim() || '(no summary)',
        '',
      );
    }
  }
  if (packet.completedTasks.length > 0) {
    lines.push('## Completed tasks');
    for (const task of packet.completedTasks) {
      const source = task.noteTitle ? ` _(from ${task.noteTitle})_` : '';
      lines.push(`- ${task.text}${source}`);
    }
    lines.push('');
  }
  if (packet.modifiedNotes.length > 0) {
    lines.push('## Notes modified this week');
    for (const note of packet.modifiedNotes) lines.push(`- ${note.title}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

export const StatusReportUseCasesLive = Layer.effect(
  StatusReportUseCasesPort,
  Effect.gen(function* () {
    const notes = yield* NoteRepositoryPort;
    const workspaces = yield* WorkspaceRepositoryPort;
    const meetings = yield* MeetingRecordingRepositoryPort;
    const journals = yield* JournalUseCasesPort;
    const tasks = yield* TaskUseCasesPort;
    const generator = yield* TextGeneratorPort;
    const service: IStatusReportUseCases = {
      generate: {
        execute: (request = {}) =>
          Effect.gen(function* () {
            const workspaceId =
              request.workspaceId ??
              (yield* workspaces.findActive())?.id;
            if (!workspaceId) {
              return yield* Effect.fail(
                new Error('No active workspace'),
              );
            }
            const windowDays =
              request.windowDays && request.windowDays > 0
                ? Math.min(request.windowDays, 31)
                : DEFAULT_WINDOW_DAYS;
            const now = yield* Effect.clockWith(
              (clock) => clock.currentTimeMillis,
            );
            const current = new Date(now);
            const windowEnd = new Date(
              current.getFullYear(),
              current.getMonth(),
              current.getDate(),
            );
            const windowStart = new Date(
              windowEnd.getTime() - (windowDays - 1) * DAY_MS,
            );
            const endExclusive = new Date(windowEnd.getTime() + DAY_MS);
            const [
              journalEntries,
              meetingEvidence,
              completedTasks,
              modifiedNotes,
            ] = yield* Effect.all(
              [
                journals.listRange({ limit: windowDays, workspaceId }).pipe(
                  Effect.map(({ entries }) =>
                    entries
                      .filter(
                        (entry) =>
                          Boolean(entry.content) &&
                          entry.date >= formatJournalDate(windowStart),
                      )
                      .map((entry) => ({
                        date: entry.date,
                        content: entry.content ?? '',
                      })),
                  ),
                  Effect.catchAll(() => Effect.succeed([])),
                ),
                meetings.list({ workspaceId, limit: 200 }).pipe(
                  Effect.map(({ recordings }) =>
                    recordings
                      .filter(
                        (recording) =>
                          recording.createdAt >= windowStart &&
                          recording.createdAt < endExclusive,
                      )
                      .slice(0, MAX_MEETINGS)
                      .map((recording) => ({
                        date: formatJournalDate(recording.createdAt),
                        title: recording.title,
                        summary: recording.summary,
                      })),
                  ),
                  Effect.catchAll(() => Effect.succeed([])),
                ),
                tasks.getAllTasks.execute().pipe(
                  Effect.map((all) =>
                    all
                      .filter(
                        (task) =>
                          task.checked &&
                          task.updatedAt >= windowStart &&
                          task.updatedAt < endExclusive,
                      )
                      .map((task) => ({
                        noteTitle: task.noteTitle,
                        text: task.text,
                        updatedAt: task.updatedAt,
                      })),
                  ),
                  Effect.catchAll(() => Effect.succeed([])),
                ),
                notes
                  .findRecentlyUpdated(MAX_NOTE_TITLES * 4, workspaceId)
                  .pipe(
                    Effect.map((recent) =>
                      recent
                        .filter(
                          (note) =>
                            !note.isDeleted &&
                            note.updatedAt >= windowStart &&
                            note.updatedAt < endExclusive,
                        )
                        .slice(0, MAX_NOTE_TITLES)
                        .map((note) => ({
                          title: note.title || 'Untitled',
                          updatedAt: note.updatedAt,
                        })),
                    ),
                    Effect.catchAll(() => Effect.succeed([])),
                  ),
              ],
              { concurrency: 'unbounded' },
            );
            const evidence = renderEvidence({
              windowStart,
              windowEnd,
              journalEntries,
              meetings: meetingEvidence,
              completedTasks,
              modifiedNotes,
            });
            const template =
              request.promptTemplate ?? DEFAULT_STATUS_REPORT_PROMPT;
            const prompt = template.includes('{{evidence}}')
              ? template.replaceAll('{{evidence}}', evidence)
              : `${template}\n\nEvidence:\n${evidence}`;
            const { text } = yield* generator.generateMarkdown({
              prompt,
              system:
                'You produce only the markdown the user asks for. Output the result directly with no preamble or closing remarks.',
            });
            return {
              windowStart: formatJournalDate(windowStart),
              windowEnd: formatJournalDate(windowEnd),
              evidence: {
                journalEntries: journalEntries.length,
                meetings: meetingEvidence.length,
                completedTasks: completedTasks.length,
                modifiedNotes: modifiedNotes.length,
              },
              report: text.trim(),
            };
          }),
      },
    };
    return service;
  }),
);
