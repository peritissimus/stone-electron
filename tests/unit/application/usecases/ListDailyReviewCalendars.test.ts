import { describe, expect, it, vi } from 'vitest';
import { ListDailyReviewCalendarsUseCase } from '../../../../src/main/application/usecases/dailyReview/ListDailyReviewCalendarsUseCase';
import type { ICalendarSource } from '../../../../src/main/domain';

describe('ListDailyReviewCalendarsUseCase', () => {
  it('returns available calendars and access status', async () => {
    const calendarSource: ICalendarSource = {
      listCalendars: vi.fn(async () => ({
        status: 'connected' as const,
        data: [{ id: 'work', title: 'Work', source: 'iCloud' }],
      })),
      getEventsForDate: vi.fn(async () => ({ status: 'connected' as const, data: [] })),
    };

    await expect(new ListDailyReviewCalendarsUseCase(calendarSource).execute()).resolves.toEqual({
      status: 'connected',
      calendars: [{ id: 'work', title: 'Work', source: 'iCloud' }],
    });
  });

  it('reports Calendar as unavailable when no platform adapter exists', async () => {
    await expect(new ListDailyReviewCalendarsUseCase().execute()).resolves.toMatchObject({
      status: 'unavailable',
      calendars: [],
    });
  });
});
