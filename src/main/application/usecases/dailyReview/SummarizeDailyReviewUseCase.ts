/**
 * SummarizeDailyReviewUseCase — turns today's snapshot (journal, meetings,
 * tasks, calendar, mail, Linear) into a short markdown briefing via the text
 * generator, optionally appending it to today's journal entry.
 *
 * Cloud privacy gates are enforced inside the text generator
 * (assertCloudNoteContentAllowed); this use case adds no new egress.
 */

import type {
  DailyReviewSnapshot,
  IGetDailyReviewUseCase,
  ISummarizeDailyReviewUseCase,
  ITextGenerator,
  SummarizeDailyReviewRequest,
  SummarizeDailyReviewResponse,
} from '../../../domain';

const SYSTEM_PROMPT =
  'You write a brief daily briefing from the structured notes below. Lead with a one-line gist, then only the sections that have content (e.g. Focus, Meetings, Tasks, Inbox). Be concrete and skimmable; no preamble, no invented details. Output markdown only.';

export interface SummarizeDailyReviewUseCaseDeps {
  getDailyReview: IGetDailyReviewUseCase;
  textGenerator: ITextGenerator;
  appendToJournal: (
    content: string,
    workspaceId?: string,
  ) => Promise<{ noteId: string; appended: boolean }>;
}

export class SummarizeDailyReviewUseCase implements ISummarizeDailyReviewUseCase {
  constructor(private readonly deps: SummarizeDailyReviewUseCaseDeps) {}

  async execute(
    request: SummarizeDailyReviewRequest = {},
  ): Promise<SummarizeDailyReviewResponse> {
    const snapshot = await this.deps.getDailyReview.execute({
      workspaceId: request.workspaceId,
      date: request.date,
    });

    const prompt = buildPrompt(snapshot);
    const result = await this.deps.textGenerator.generateMarkdown({
      prompt,
      system: SYSTEM_PROMPT,
    });
    const summary = result.text.trim();

    let journalNoteId: string | null = null;
    if (request.saveToJournal && summary) {
      const appended = await this.deps.appendToJournal(
        `## Daily summary\n\n${summary}`,
        request.workspaceId,
      );
      journalNoteId = appended.noteId;
    }

    return { summary, journalNoteId };
  }
}

function buildPrompt(s: DailyReviewSnapshot): string {
  const lines: string[] = [`Date: ${s.date}`, ''];

  if (s.todayJournal.contentPreview) {
    lines.push('## Journal so far', s.todayJournal.contentPreview, '');
  }

  if (s.calendarEvents?.length) {
    lines.push('## Calendar');
    for (const e of s.calendarEvents) {
      const when = e.allDay ? 'all day' : `${formatTime(e.start)}–${formatTime(e.end)}`;
      lines.push(`- ${when} · ${e.title}${e.location ? ` (${e.location})` : ''}`);
    }
    lines.push('');
  }

  if (s.todayMeetings.length) {
    lines.push('## Meetings');
    for (const m of s.todayMeetings) {
      lines.push(`- ${m.title}${m.summary ? `: ${m.summary}` : ''}`);
    }
    lines.push('');
  }

  if (s.openTasks.length) {
    lines.push('## Open tasks');
    for (const t of s.openTasks) lines.push(`- [${t.state}] ${t.text}`);
    lines.push('');
  }

  if (s.linearIssues?.length) {
    lines.push('## Linear');
    for (const i of s.linearIssues) {
      lines.push(`- ${i.identifier} ${i.title} (${i.state}${i.dueDate ? `, due ${i.dueDate}` : ''})`);
    }
    lines.push('');
  }

  if (s.mailMessages?.length) {
    lines.push('## Unread mail');
    for (const m of s.mailMessages) lines.push(`- ${m.subject} — ${m.sender}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
