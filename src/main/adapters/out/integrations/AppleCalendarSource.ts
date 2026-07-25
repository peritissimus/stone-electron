/** AppleCalendarSource — reads calendar metadata and bounded event ranges from
 * EventKit through Stone's signed native bridge. */

import { Effect } from 'effect';
import type {
  CalendarDescriptor,
  CalendarEvent,
  ICalendarSource,
} from '../../../domain/ports/out/ICalendarSource';
import type {
  ExternalSourceLoadContext,
  IExternalSource,
} from '../../../domain/ports/out/IExternalSource';
import type { ExternalSourceResult } from '../../../domain/ports/out/externalSourceResult';
import { logger } from '../../../shared/utils';
import {
  commandTimeout,
  runCommand,
  type CommandRunner,
} from './commandRunner';

interface BridgeResponse<T> {
  status?: ExternalSourceResult<T[]>['status'];
  data?: unknown[];
  message?: string;
}

export class AppleCalendarSource implements ICalendarSource, IExternalSource {
  readonly source = 'calendar' as const;

  constructor(
    private readonly bridgePath: string,
    private readonly runPromise: <A, E>(
      effect: Effect.Effect<A, E>,
      options?: { signal?: AbortSignal },
    ) => Promise<A>,
    private readonly commandRunner: CommandRunner = runCommand,
  ) {}

  async listCalendars(): Promise<ExternalSourceResult<CalendarDescriptor[]>> {
    const result = await this.runBridge<CalendarDescriptor>(['list'], mapCalendar);
    return result;
  }

  async getEventsForDate(
    date: string,
    calendarIds: readonly string[] | null,
    signal?: AbortSignal,
  ): Promise<ExternalSourceResult<CalendarEvent[]>> {
    if (calendarIds !== null && calendarIds.length === 0) {
      return { status: 'connected', data: [] };
    }
    return this.runBridge<CalendarEvent>(
      ['events', date, ...(calendarIds === null ? ['--all'] : calendarIds)],
      mapEvent,
      signal,
    );
  }

  async load(context: ExternalSourceLoadContext) {
    const result = await this.getEventsForDate(context.date, context.calendarIds, context.signal);
    return {
      source: this.source,
      status: result.status,
      data: { events: result.data },
      ...(result.message ? { message: result.message } : {}),
    };
  }

  private runBridge<T>(
    args: string[],
    mapItem: (value: unknown) => T,
    signal?: AbortSignal,
  ): Promise<ExternalSourceResult<T[]>> {
    if (process.platform !== 'darwin') {
      return Promise.resolve({
        status: 'unavailable',
        data: [],
        message: 'Available on macOS only.',
      });
    }

    return this.runPromise(
      this.commandRunner(
        this.bridgePath,
        args,
        { maxBuffer: 1024 * 1024 },
      ).pipe(
        Effect.timeoutFail({
          duration: 30_000,
          onTimeout: () => commandTimeout('Calendar bridge timed out'),
        }),
        Effect.match({
          onFailure: (error): ExternalSourceResult<T[]> => {
            const timedOut = error.name === 'CommandTimeoutError';
            logger.warn('[CalendarBridge] request failed', {
              code: 'code' in error ? (error as Error & { code?: unknown }).code ?? null : null,
              killed: timedOut,
            });
            return {
              status: timedOut ? 'error' : 'unavailable',
              data: [],
              message: timedOut
                ? 'Calendar permission was not completed in time.'
                : 'The Calendar connection is unavailable.',
            };
          },
          onSuccess: ({ stdout }): ExternalSourceResult<T[]> => {
          try {
            const response = JSON.parse(stdout.trim()) as BridgeResponse<T>;
            return {
              status: response.status ?? 'error',
              data: Array.isArray(response.data) ? response.data.map(mapItem) : [],
              ...(response.message ? { message: response.message } : {}),
            };
          } catch {
            return { status: 'error', data: [], message: 'Calendar returned invalid data.' };
          }
          },
        }),
      ),
      { signal },
    );
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function mapCalendar(value: unknown): CalendarDescriptor {
  const calendar = asRecord(value);
  return {
    id: String(calendar.id ?? ''),
    title: String(calendar.title ?? 'Untitled calendar'),
    source: String(calendar.source ?? ''),
  };
}

function mapEvent(value: unknown): CalendarEvent {
  const event = asRecord(value);
  return {
    title: String(event.title ?? '(no title)'),
    start: String(event.start ?? ''),
    end: String(event.end ?? ''),
    allDay: Boolean(event.allDay),
    calendar: String(event.calendar ?? ''),
    location: event.location ? String(event.location) : null,
  };
}
