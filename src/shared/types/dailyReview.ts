/**
 * Wire shape for the Daily Review snapshot. Mirrors the domain port
 * (IDailyReviewUseCases) — duplicated here because @shared can't
 * import from the main process.
 */

import type { Note, TodoItem } from './index';

export interface DailyReviewTodayJournal {
  date: string;
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

export interface DailyReviewSnapshot {
  date: string;
  todayJournal: DailyReviewTodayJournal;
  todayMeetings: DailyReviewMeetingSummary[];
  openTasks: TodoItem[];
  recentNotes: Note[];
  onThisDay: DailyReviewOnThisDayEntry[];
}
