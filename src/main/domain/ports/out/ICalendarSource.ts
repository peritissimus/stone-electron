/**
 * ICalendarSource — read-only access to the user's calendar for a given day.
 * Implemented on macOS via Calendar.app (JXA); other platforms return [].
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

export interface ICalendarSource {
  /** Events on the given local date (YYYY-MM-DD). Returns [] when unavailable
   *  (unsupported platform, permission denied, no calendar app). */
  getEventsForDate(date: string): Promise<CalendarEvent[]>;
}
