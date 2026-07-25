/**
 * Wire shape for the Daily Review snapshot. Mirrors the domain port
 * (IDailyReviewUseCases) — duplicated here because @shared can't
 * import from the main process.
 */

import type { Note, TodoItem } from './index';

export interface DailyReviewTodayJournal {
  date: string;
  exists: boolean;
  noteId: string | null;
  contentPreview: string | null;
}

export interface DailyReviewMeetingSummary {
  id: string;
  title: string;
  status: 'recording' | 'transcribing' | 'summarizing' | 'ready' | 'failed';
  durationMs: number;
  summary: string | null;
  createdAt: Date;
  inJournal: boolean;
}

export interface DailyReviewOnThisDayEntry {
  yearsAgo: number;
  date: Date;
  note: Note;
}

export interface CalendarEvent {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  calendar: string;
  location: string | null;
}

export interface MailMessage {
  subject: string;
  sender: string;
  receivedAt: string;
}

export interface LinearIssue {
  identifier: string;
  title: string;
  state: string;
  priority: number;
  url: string;
  dueDate: string | null;
}

export type DailyReviewIntegrationSource = 'calendar' | 'mail' | 'linear';
export type DailyReviewIntegrationStatus = 'connected' | 'denied' | 'unavailable' | 'error';

export interface CalendarDescriptor {
  id: string;
  title: string;
  source: string;
}

export interface ListDailyReviewCalendarsResult {
  status: DailyReviewIntegrationStatus;
  calendars: CalendarDescriptor[];
  message?: string;
}

interface DailyReviewIntegrationResultBase {
  status: DailyReviewIntegrationStatus;
  message?: string;
}

export type DailyReviewIntegrationResult =
  | (DailyReviewIntegrationResultBase & {
      source: 'calendar';
      data: { events: CalendarEvent[] };
    })
  | (DailyReviewIntegrationResultBase & {
      source: 'mail';
      data: { unreadCount: number; messages: MailMessage[] };
    })
  | (DailyReviewIntegrationResultBase & {
      source: 'linear';
      data: { issues: LinearIssue[] };
    });

export interface DailyReviewSnapshot {
  date: string;
  todayJournal: DailyReviewTodayJournal;
  todayMeetings: DailyReviewMeetingSummary[];
  openTasks: TodoItem[];
  recentNotes: Note[];
  onThisDay: DailyReviewOnThisDayEntry[];
  /** External integrations — present only when the source is available. */
  calendarEvents?: CalendarEvent[];
  mailUnreadCount?: number;
  mailMessages?: MailMessage[];
  linearIssues?: LinearIssue[];
}
