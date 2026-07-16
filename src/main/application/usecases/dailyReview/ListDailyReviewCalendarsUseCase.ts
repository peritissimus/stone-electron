import type {
  ICalendarSource,
  IListDailyReviewCalendarsUseCase,
  ListDailyReviewCalendarsResult,
} from '../../../domain';

export class ListDailyReviewCalendarsUseCase implements IListDailyReviewCalendarsUseCase {
  constructor(private readonly calendarSource?: ICalendarSource) {}

  async execute(): Promise<ListDailyReviewCalendarsResult> {
    if (!this.calendarSource) {
      return {
        status: 'unavailable',
        calendars: [],
        message: 'Calendar is not available on this platform.',
      };
    }

    try {
      const result = await this.calendarSource.listCalendars();
      return {
        status: result.status,
        calendars: result.data,
        ...(result.message ? { message: result.message } : {}),
      };
    } catch {
      return { status: 'error', calendars: [], message: 'Could not list calendars.' };
    }
  }
}
