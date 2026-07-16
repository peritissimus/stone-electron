import { describe, expect, it, vi } from 'vitest';
import { LoadDailyReviewIntegrationUseCase } from '../../../../src/main/application/usecases/dailyReview/LoadDailyReviewIntegrationUseCase';
import type { ICalendarSource, IMailSource } from '../../../../src/main/domain';

describe('LoadDailyReviewIntegrationUseCase', () => {
  it('returns calendar data with its access status', async () => {
    const calendarSource: ICalendarSource = {
      getEventsForDate: vi.fn(async () => ({
        status: 'connected' as const,
        data: [
          {
            title: 'Design review',
            start: '2026-07-16T09:00:00.000Z',
            end: '2026-07-16T09:30:00.000Z',
            allDay: false,
            calendar: 'Work',
            location: null,
          },
        ],
      })),
    };
    const useCase = new LoadDailyReviewIntegrationUseCase({ calendarSource });

    const result = await useCase.execute({ source: 'calendar', date: '2026-07-16' });

    expect(calendarSource.getEventsForDate).toHaveBeenCalledWith('2026-07-16');
    expect(result).toMatchObject({
      source: 'calendar',
      status: 'connected',
      calendarEvents: [{ title: 'Design review' }],
    });
  });

  it('keeps denied mail access distinct from an empty inbox', async () => {
    const mailSource: IMailSource = {
      getUnreadMessages: vi.fn(async () => ({
        status: 'denied' as const,
        data: [],
        message: 'Access is blocked in macOS Automation settings.',
      })),
    };
    const useCase = new LoadDailyReviewIntegrationUseCase({ mailSource });

    const result = await useCase.execute({ source: 'mail' });

    expect(result).toEqual({
      source: 'mail',
      status: 'denied',
      mailMessages: [],
      message: 'Access is blocked in macOS Automation settings.',
    });
  });

  it('reports sources that are unavailable on the current platform', async () => {
    const useCase = new LoadDailyReviewIntegrationUseCase({});

    await expect(useCase.execute({ source: 'calendar' })).resolves.toMatchObject({
      source: 'calendar',
      status: 'unavailable',
    });
  });
});
