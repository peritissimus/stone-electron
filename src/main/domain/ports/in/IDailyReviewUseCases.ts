/**
 * Daily Review Use Cases Port
 *
 * Aggregates today's snapshot from existing sources (journal, meetings,
 * tasks, recently-updated notes, on-this-day) into a single wire shape
 * the renderer can render as one page. Pure orchestration — no new
 * persistence.
 */

import type { NoteProps } from '../../entities';
import type { TaskItem } from './ITaskUseCases';
import type { CalendarEvent } from '../out/ICalendarSource';
import type { MailMessage } from '../out/IMailSource';
import type { LinearIssue } from '../out/ILinearSource';

export interface DailyReviewTodayJournal {
  /** YYYY-MM-DD for today's local date. */
  date: string;
  /** Null when no journal entry exists for today yet. */
  noteId: string | null;
  /** First few lines of the journal body; null if empty / not created. */
  contentPreview: string | null;
}

export interface DailyReviewMeetingSummary {
  id: string;
  title: string;
  status:
    | 'recording'
    | 'transcribing'
    | 'summarizing'
    | 'ready'
    | 'failed';
  durationMs: number;
  summary: string | null;
  createdAt: Date;
  /** True when the summary has been published to the journal. */
  inJournal: boolean;
}

export interface DailyReviewOnThisDayEntry {
  yearsAgo: number;
  date: Date;
  note: NoteProps;
}

export interface DailyReviewSnapshot {
  /** ISO date the snapshot was generated for. */
  date: string;
  todayJournal: DailyReviewTodayJournal;
  todayMeetings: DailyReviewMeetingSummary[];
  openTasks: TaskItem[];
  recentNotes: NoteProps[];
  onThisDay: DailyReviewOnThisDayEntry[];
  /** External integrations — present only when the source is available. */
  calendarEvents?: CalendarEvent[];
  mailMessages?: MailMessage[];
  linearIssues?: LinearIssue[];
}

export interface GetDailyReviewRequest {
  workspaceId?: string;
  /** Optional date override (YYYY-MM-DD); defaults to today's local date. */
  date?: string;
}

export interface IGetDailyReviewUseCase {
  execute(request?: GetDailyReviewRequest): Promise<DailyReviewSnapshot>;
}

export interface SummarizeDailyReviewRequest {
  workspaceId?: string;
  date?: string;
  /** When true, append the summary to today's journal entry. */
  saveToJournal?: boolean;
}

export interface SummarizeDailyReviewResponse {
  /** Markdown summary of the day. */
  summary: string;
  /** Journal note the summary was appended to, when saveToJournal was set. */
  journalNoteId: string | null;
}

export interface ISummarizeDailyReviewUseCase {
  execute(request?: SummarizeDailyReviewRequest): Promise<SummarizeDailyReviewResponse>;
}

export interface IDailyReviewUseCases {
  getDailyReview: IGetDailyReviewUseCase;
  summarizeDailyReview: ISummarizeDailyReviewUseCase;
}
