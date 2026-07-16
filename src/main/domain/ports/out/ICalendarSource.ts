import type { ExternalSourceResult } from './externalSourceResult';

/**
 * ICalendarSource — read-only access to the user's calendar for a given day.
 * Implemented on macOS via EventKit; other platforms report unavailable.
 */

export interface CalendarEvent {
  title: string;
  /** ISO 8601 start; for all-day events the date portion is what matters. */
  start: string;
  /** ISO 8601 end. */
  end: string;
  allDay: boolean;
  /** Name of the calendar the event belongs to. */
  calendar: string;
  location: string | null;
}

export interface CalendarDescriptor {
  /** Stable EventKit identifier used to persist the user's selection. */
  id: string;
  title: string;
  /** Account/source name, used to disambiguate calendars with the same title. */
  source: string;
}

export interface ICalendarSource {
  /** Calendars available to the app after access is granted. */
  listCalendars(): Promise<ExternalSourceResult<CalendarDescriptor[]>>;
  /** Events on the given local date plus an actionable access status. */
  getEventsForDate(
    date: string,
    calendarIds: readonly string[] | null,
  ): Promise<ExternalSourceResult<CalendarEvent[]>>;
}
