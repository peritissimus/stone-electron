/**
 * Daily Review Use Cases Port
 *
 * Aggregates today's snapshot from existing sources (journal, meetings,
 * tasks, recently-updated notes, on-this-day) into a single wire shape
 * the renderer can render as one page. Pure orchestration — no new
 * persistence.
 */

import { Context } from 'effect';
import type { Effect } from 'effect';
import type { NoteProps } from '../../entities';
import type { TaskItem } from './ITaskUseCases';
import type { CalendarDescriptor, CalendarEvent } from '../out/ICalendarSource';
import type { MailMessage } from '../out/IMailSource';
import type { LinearIssue } from '../out/ILinearSource';
import type { DailyReviewExternalResult, ExternalSourceId } from '../out/IExternalSource';
import type { ExternalSourceStatus } from '../out/externalSourceResult';

export interface DailyReviewTodayJournal {
  /** YYYY-MM-DD for today's local date. */
  date: string;
  /** True when today's markdown file exists, even if it is not indexed yet. */
  exists: boolean;
  /** Null when no journal entry exists for today yet. */
  noteId: string | null;
  /** First few lines of the journal body; null if empty / not created. */
  contentPreview: string | null;
}

export interface DailyReviewMeetingSummary {
  id: string;
  title: string;
  status: 'recording' | 'transcribing' | 'summarizing' | 'ready' | 'failed';
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
  mailUnreadCount?: number;
  mailMessages?: MailMessage[];
  linearIssues?: LinearIssue[];
}

export interface GetDailyReviewRequest {
  workspaceId?: string;
  /** Optional date override (YYYY-MM-DD); defaults to today's local date. */
  date?: string;
}

export type DailyReviewIntegrationSource = ExternalSourceId;

export interface LoadDailyReviewIntegrationRequest {
  source: DailyReviewIntegrationSource;
  /** Optional date override (YYYY-MM-DD); defaults to today's local date. */
  date?: string;
}

export type DailyReviewIntegrationResult = DailyReviewExternalResult;

/**
 * What a source load yields: its own result, plus the snapshot that result now
 * belongs in. Handing back both keeps the merge in one module — the caller
 * applies a snapshot rather than reproducing the mapping from each source's
 * payload onto the day.
 *
 * `snapshot` is null when a transport has no sources to merge, which means
 * "nothing newer to apply" rather than "the day is empty".
 */
export interface DailyReviewIntegrationOutcome {
  result: DailyReviewIntegrationResult;
  snapshot: DailyReviewSnapshot | null;
}

export interface DailyReviewIntegrationsOutcome {
  results: DailyReviewIntegrationResult[];
  snapshot: DailyReviewSnapshot | null;
}

export interface ListDailyReviewCalendarsResult {
  status: ExternalSourceStatus;
  calendars: CalendarDescriptor[];
  message?: string;
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

export interface IDailyReviewUseCases {
  getDailyReview: {
    execute: (
      request?: GetDailyReviewRequest,
    ) => Effect.Effect<DailyReviewSnapshot, Error>;
  };
  listCalendars: {
    execute: () => Effect.Effect<ListDailyReviewCalendarsResult, never>;
  };
  /**
   * Loads one source and returns the snapshot it now belongs in, so the caller
   * never has to re-read the day to collect data it was already handed.
   */
  loadIntegration: {
    execute: (
      request: LoadDailyReviewIntegrationRequest,
    ) => Effect.Effect<DailyReviewIntegrationOutcome, Error>;
  };
  loadIntegrations: {
    execute: (
      request?: { date?: string },
    ) => Effect.Effect<DailyReviewIntegrationsOutcome, Error>;
  };
  summarizeDailyReview: {
    execute: (
      request?: SummarizeDailyReviewRequest,
    ) => Effect.Effect<SummarizeDailyReviewResponse, Error>;
  };
}

export const DailyReviewUseCasesPort =
  Context.GenericTag<IDailyReviewUseCases>('stone/IDailyReviewUseCases');
