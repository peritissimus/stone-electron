import type {
  CalendarDescriptor,
  CalendarEvent,
  ExternalSourceResult,
  ICalendarSource,
} from '../../../domain';

const UNAVAILABLE = 'Calendar integration is available in the desktop app.';

/**
 * Headless implementation: reading the calendar means talking to EventKit on
 * the user's own machine, which a server has no access to. Reports unavailable
 * so the daily review renders without it rather than failing.
 */
export class ServerCalendarSource implements ICalendarSource {
  async listCalendars(): Promise<ExternalSourceResult<CalendarDescriptor[]>> {
    return { status: 'unavailable', data: [], message: UNAVAILABLE };
  }

  async getEventsForDate(): Promise<ExternalSourceResult<CalendarEvent[]>> {
    return { status: 'unavailable', data: [], message: UNAVAILABLE };
  }
}
