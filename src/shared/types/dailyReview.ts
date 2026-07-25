/** Wire types are derived from the shared Effect schemas. */
import type { Note, TodoItem } from './index';
import type {
  DailyReviewSnapshot as SchemaDailyReviewSnapshot,
} from '../schemas/dailyReview';

export type {
  CalendarDescriptor,
  CalendarEvent,
  DailyReviewIntegrationResult,
  DailyReviewIntegrationSource,
  DailyReviewIntegrationStatus,
  DailyReviewMeetingSummary,
  DailyReviewTodayJournal,
  LinearIssue,
  ListDailyReviewCalendarsResult,
  MailMessage,
} from '../schemas/dailyReview';

export interface DailyReviewOnThisDayEntry {
  yearsAgo: number;
  date: Date;
  note: Note;
}

export type DailyReviewSnapshot = Omit<
  SchemaDailyReviewSnapshot,
  'openTasks' | 'recentNotes' | 'onThisDay'
> & {
  openTasks: TodoItem[];
  recentNotes: Note[];
  onThisDay: DailyReviewOnThisDayEntry[];
};
