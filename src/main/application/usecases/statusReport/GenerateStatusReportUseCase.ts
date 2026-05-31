/**
 * GenerateStatusReportUseCase — drafts a weekly status report by
 * synthesising recent journal entries, meeting summaries, completed
 * tasks, and modified notes into an "evidence packet" that's handed
 * to the text generator with the status-report prompt.
 *
 * Pulls only metadata + summaries — never raw note bodies — to keep
 * the prompt within practical context limits and to scope cloud-AI
 * exfiltration risk. Cloud privacy gates are enforced inside the
 * text generator already (assertCloudNoteContentAllowed).
 */

import {
  DEFAULT_STATUS_REPORT_PROMPT,
  type IJournalUseCases,
  type IMeetingRecordingRepository,
  type INoteRepository,
  type ITaskUseCases,
  type ITextGenerator,
  type IWorkspaceRepository,
} from '../../../domain';
import type {
  GenerateStatusReportRequest,
  GenerateStatusReportResponse,
  IGenerateStatusReportUseCase,
  StatusReportEvidenceCounts,
} from '../../../domain/ports/in/IStatusReportUseCases';

const DEFAULT_WINDOW_DAYS = 7;
const MAX_NOTE_TITLES = 20;
const MAX_MEETINGS = 15;

export interface GenerateStatusReportUseCaseDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  meetingRepository: IMeetingRecordingRepository;
  journalUseCases: IJournalUseCases;
  taskUseCases: ITaskUseCases;
  textGenerator: ITextGenerator;
}

export class GenerateStatusReportUseCase implements IGenerateStatusReportUseCase {
  constructor(private readonly deps: GenerateStatusReportUseCaseDeps) {}

  async execute(
    request: GenerateStatusReportRequest = {},
  ): Promise<GenerateStatusReportResponse> {
    const workspaceId =
      request.workspaceId ?? (await this.deps.workspaceRepository.findActive())?.id;
    if (!workspaceId) {
      throw new Error('No active workspace');
    }

    const windowDays = request.windowDays && request.windowDays > 0
      ? Math.min(request.windowDays, 31)
      : DEFAULT_WINDOW_DAYS;

    const now = new Date();
    const windowEnd = startOfDay(now);
    const windowStart = new Date(windowEnd.getTime() - (windowDays - 1) * 24 * 60 * 60 * 1000);
    const windowEndExclusive = new Date(windowEnd.getTime() + 24 * 60 * 60 * 1000);

    const [journalEntries, meetings, completedTasks, modifiedNotes] = await Promise.all([
      this.collectJournalEntries(workspaceId, windowStart, windowEndExclusive),
      this.collectMeetings(workspaceId, windowStart, windowEndExclusive),
      this.collectCompletedTasks(windowStart, windowEndExclusive),
      this.collectModifiedNotes(workspaceId, windowStart, windowEndExclusive),
    ]);

    const counts: StatusReportEvidenceCounts = {
      journalEntries: journalEntries.length,
      meetings: meetings.length,
      completedTasks: completedTasks.length,
      modifiedNotes: modifiedNotes.length,
    };

    const evidence = renderEvidence({
      windowStart,
      windowEnd,
      journalEntries,
      meetings,
      completedTasks,
      modifiedNotes,
    });

    const template = request.promptTemplate ?? DEFAULT_STATUS_REPORT_PROMPT;
    const prompt = template.includes('{{evidence}}')
      ? template.replaceAll('{{evidence}}', evidence)
      : `${template}\n\nEvidence:\n${evidence}`;

    const { text } = await this.deps.textGenerator.generateMarkdown({
      prompt,
      system:
        'You produce only the markdown the user asks for. Output the result directly with no preamble or closing remarks.',
    });

    return {
      windowStart: formatIso(windowStart),
      windowEnd: formatIso(windowEnd),
      evidence: counts,
      report: text.trim(),
    };
  }

  private async collectJournalEntries(
    workspaceId: string,
    start: Date,
    endExclusive: Date,
  ): Promise<Array<{ date: string; content: string }>> {
    try {
      const limit = Math.ceil((endExclusive.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      const { entries } = await this.deps.journalUseCases.listRange({
        limit,
        workspaceId,
      });
      return entries
        .filter((entry) => Boolean(entry.content) && entry.date >= formatIso(start))
        .map((entry) => ({ date: entry.date, content: entry.content ?? '' }));
    } catch {
      return [];
    }
  }

  private async collectMeetings(
    workspaceId: string,
    start: Date,
    endExclusive: Date,
  ): Promise<
    Array<{ date: string; title: string; summary: string | null }>
  > {
    try {
      const { recordings } = await this.deps.meetingRepository.list({
        workspaceId,
        limit: 200,
      });
      return recordings
        .filter((r) => r.createdAt >= start && r.createdAt < endExclusive)
        .slice(0, MAX_MEETINGS)
        .map((r) => ({
          date: formatIso(r.createdAt),
          title: r.title,
          summary: r.summary,
        }));
    } catch {
      return [];
    }
  }

  private async collectCompletedTasks(
    start: Date,
    endExclusive: Date,
  ): Promise<Array<{ noteTitle: string | null; text: string; updatedAt: Date }>> {
    try {
      const all = await this.deps.taskUseCases.getAllTasks.execute();
      return all
        .filter(
          (task) =>
            task.checked && task.updatedAt >= start && task.updatedAt < endExclusive,
        )
        .map((task) => ({
          noteTitle: task.noteTitle,
          text: task.text,
          updatedAt: task.updatedAt,
        }));
    } catch {
      return [];
    }
  }

  private async collectModifiedNotes(
    workspaceId: string,
    start: Date,
    endExclusive: Date,
  ): Promise<Array<{ title: string; updatedAt: Date }>> {
    try {
      const recent = await this.deps.noteRepository.findRecentlyUpdated(
        MAX_NOTE_TITLES * 4,
        workspaceId,
      );
      return recent
        .filter(
          (note) =>
            !note.isDeleted &&
            note.updatedAt >= start &&
            note.updatedAt < endExclusive,
        )
        .slice(0, MAX_NOTE_TITLES)
        .map((note) => ({
          title: note.title || 'Untitled',
          updatedAt: note.updatedAt,
        }));
    } catch {
      return [];
    }
  }
}

// ============================================================================
// Evidence rendering
// ============================================================================

interface EvidencePacket {
  windowStart: Date;
  windowEnd: Date;
  journalEntries: Array<{ date: string; content: string }>;
  meetings: Array<{ date: string; title: string; summary: string | null }>;
  completedTasks: Array<{ noteTitle: string | null; text: string; updatedAt: Date }>;
  modifiedNotes: Array<{ title: string; updatedAt: Date }>;
}

function renderEvidence(packet: EvidencePacket): string {
  const lines: string[] = [];

  lines.push(`Window: ${formatIso(packet.windowStart)} to ${formatIso(packet.windowEnd)}.`);
  lines.push('');

  if (packet.journalEntries.length > 0) {
    lines.push('## Daily journal entries');
    for (const entry of packet.journalEntries) {
      lines.push(`### ${entry.date}`);
      lines.push(entry.content.trim());
      lines.push('');
    }
  } else {
    lines.push('## Daily journal entries');
    lines.push('(none in window)');
    lines.push('');
  }

  if (packet.meetings.length > 0) {
    lines.push('## Meetings');
    for (const m of packet.meetings) {
      lines.push(`### ${m.date} — ${m.title}`);
      lines.push(m.summary?.trim() || '(no summary)');
      lines.push('');
    }
  }

  if (packet.completedTasks.length > 0) {
    lines.push('## Completed tasks');
    for (const task of packet.completedTasks) {
      const where = task.noteTitle ? ` _(from ${task.noteTitle})_` : '';
      lines.push(`- ${task.text}${where}`);
    }
    lines.push('');
  }

  if (packet.modifiedNotes.length > 0) {
    lines.push('## Notes modified this week');
    for (const note of packet.modifiedNotes) {
      lines.push(`- ${note.title}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

function formatIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
