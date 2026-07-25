import type { DailyReviewSnapshot } from '../in/IDailyReviewUseCases';
import type { CalendarEvent } from './ICalendarSource';
import type { LinearIssue } from './ILinearSource';
import type { MailMessage } from './IMailSource';
import type { ExternalSourceStatus } from './externalSourceResult';

export type ExternalSourceId = 'calendar' | 'mail' | 'linear';

interface ExternalSourceResultBase {
  status: ExternalSourceStatus;
  message?: string;
}

export type DailyReviewExternalResult =
  | (ExternalSourceResultBase & {
      source: 'calendar';
      data: { events: CalendarEvent[] };
    })
  | (ExternalSourceResultBase & {
      source: 'mail';
      data: { unreadCount: number; messages: MailMessage[] };
    })
  | (ExternalSourceResultBase & {
      source: 'linear';
      data: { issues: LinearIssue[] };
    });

export interface ExternalSourceLoadContext {
  date: string;
  calendarIds: readonly string[] | null;
  mailLimit: number;
  signal?: AbortSignal;
}

export interface IExternalSource {
  readonly source: ExternalSourceId;
  load(context: ExternalSourceLoadContext): Promise<DailyReviewExternalResult>;
}

export interface IExternalSourceRegistry {
  load(
    source: ExternalSourceId,
    options?: { date?: string; signal?: AbortSignal },
  ): Promise<DailyReviewExternalResult>;
  loadAll(options?: { date?: string; signal?: AbortSignal }): Promise<DailyReviewExternalResult[]>;
  mergeInto(snapshot: DailyReviewSnapshot): DailyReviewSnapshot;
}
