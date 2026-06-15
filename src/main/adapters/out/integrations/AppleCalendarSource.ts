/**
 * AppleCalendarSource — reads a day's events from Calendar.app via JXA.
 * macOS-only; returns [] on any other platform or when Automation permission
 * is denied. Triggers a one-time macOS Automation prompt on first use.
 */

import type { CalendarEvent, ICalendarSource } from '../../../domain/ports/out/ICalendarSource';
import { runJxa } from './osascriptJxa';

interface RawEvent {
  title?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  calendar?: string;
  location?: string | null;
}

/** JXA: collect events intersecting the local day [start, nextDay). The date
 *  is injected as YYYY-MM-DD and parsed into a local Date inside the script. */
function script(date: string): string {
  return `
    (() => {
      const [y, m, d] = ${JSON.stringify(date)}.split('-').map(Number);
      const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
      const dayEnd = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
      const Cal = Application('Calendar');
      const out = [];
      const cals = Cal.calendars();
      for (const cal of cals) {
        let events;
        try {
          events = cal.events.whose({
            _and: [{ startDate: { _lessThan: dayEnd } }, { endDate: { _greaterThan: dayStart } }],
          })();
        } catch (e) {
          continue;
        }
        const calName = cal.name();
        for (const ev of events) {
          out.push({
            title: ev.summary(),
            start: ev.startDate().toISOString(),
            end: ev.endDate().toISOString(),
            allDay: ev.alldayEvent(),
            calendar: calName,
            location: ev.location() || null,
          });
        }
      }
      out.sort((a, b) => a.start.localeCompare(b.start));
      return JSON.stringify(out);
    })();
  `;
}

export class AppleCalendarSource implements ICalendarSource {
  async getEventsForDate(date: string): Promise<CalendarEvent[]> {
    const raw = await runJxa<RawEvent[]>(script(date), 12000);
    if (!raw) return [];
    return raw.map((e) => ({
      title: String(e.title ?? '(no title)'),
      start: String(e.start ?? ''),
      end: String(e.end ?? ''),
      allDay: Boolean(e.allDay),
      calendar: String(e.calendar ?? ''),
      location: e.location ? String(e.location) : null,
    }));
  }
}
