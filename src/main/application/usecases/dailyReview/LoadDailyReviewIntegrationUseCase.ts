import type {
  DailyReviewIntegrationResult,
  ICalendarSource,
  ILinearSource,
  ILoadDailyReviewIntegrationUseCase,
  IMailSource,
  LoadDailyReviewIntegrationRequest,
} from '../../../domain';

const UNREAD_MAIL_LIMIT = 10;

export interface LoadDailyReviewIntegrationUseCaseDeps {
  calendarSource?: ICalendarSource;
  mailSource?: IMailSource;
  linearSource?: ILinearSource;
}

export class LoadDailyReviewIntegrationUseCase implements ILoadDailyReviewIntegrationUseCase {
  constructor(private readonly deps: LoadDailyReviewIntegrationUseCaseDeps) {}

  async execute(request: LoadDailyReviewIntegrationRequest): Promise<DailyReviewIntegrationResult> {
    switch (request.source) {
      case 'calendar':
        return this.loadCalendar(request.date ?? todayIso());
      case 'mail':
        return this.loadMail();
      case 'linear':
        return this.loadLinear();
    }
  }

  private async loadCalendar(date: string): Promise<DailyReviewIntegrationResult> {
    if (!this.deps.calendarSource) return unavailable('calendar');
    try {
      const result = await this.deps.calendarSource.getEventsForDate(date);
      return {
        source: 'calendar',
        status: result.status,
        calendarEvents: result.data,
        ...(result.message ? { message: result.message } : {}),
      };
    } catch {
      return failed('calendar');
    }
  }

  private async loadMail(): Promise<DailyReviewIntegrationResult> {
    if (!this.deps.mailSource) return unavailable('mail');
    try {
      const result = await this.deps.mailSource.getUnreadMessages(UNREAD_MAIL_LIMIT);
      return {
        source: 'mail',
        status: result.status,
        mailUnreadCount: result.data.unreadCount,
        mailMessages: result.data.messages,
        ...(result.message ? { message: result.message } : {}),
      };
    } catch {
      return failed('mail');
    }
  }

  private async loadLinear(): Promise<DailyReviewIntegrationResult> {
    if (!this.deps.linearSource) return unavailable('linear');
    try {
      return {
        source: 'linear',
        status: 'connected',
        linearIssues: await this.deps.linearSource.getAssignedIssues(),
      };
    } catch {
      return failed('linear');
    }
  }
}

function unavailable(
  source: LoadDailyReviewIntegrationRequest['source'],
): DailyReviewIntegrationResult {
  return { source, status: 'unavailable', message: 'This integration is not available.' };
}

function failed(source: LoadDailyReviewIntegrationRequest['source']): DailyReviewIntegrationResult {
  return { source, status: 'error', message: 'Could not load this integration.' };
}

function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
