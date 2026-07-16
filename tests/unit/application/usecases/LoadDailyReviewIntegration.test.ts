import { describe, expect, it, vi } from 'vitest';
import { LoadDailyReviewIntegrationUseCase } from '../../../../src/main/application/usecases/dailyReview/LoadDailyReviewIntegrationUseCase';
import type {
  IAppConfigRepository,
  ICalendarSource,
  IMailSource,
} from '../../../../src/main/domain';
import { DEFAULT_APP_CONFIG } from '../../../../src/main/domain/value-objects/AppConfig';

describe('LoadDailyReviewIntegrationUseCase', () => {
  it('returns calendar data with its access status', async () => {
    const calendarSource: ICalendarSource = {
      listCalendars: vi.fn(async () => ({ status: 'connected' as const, data: [] })),
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

    expect(calendarSource.getEventsForDate).toHaveBeenCalledWith('2026-07-16', null);
    expect(result).toMatchObject({
      source: 'calendar',
      status: 'connected',
      calendarEvents: [{ title: 'Design review' }],
    });
  });

  it('only reads calendars selected in integration settings', async () => {
    const calendarSource: ICalendarSource = {
      listCalendars: vi.fn(async () => ({ status: 'connected' as const, data: [] })),
      getEventsForDate: vi.fn(async () => ({ status: 'connected' as const, data: [] })),
    };
    const config = {
      ...DEFAULT_APP_CONFIG,
      integrations: {
        ...DEFAULT_APP_CONFIG.integrations,
        selectedCalendarIds: ['work', 'family'],
      },
    };
    const appConfigRepository: IAppConfigRepository = {
      get: vi.fn(async () => config),
      set: vi.fn(async () => undefined),
      update: vi.fn(async () => config),
    };
    const useCase = new LoadDailyReviewIntegrationUseCase({
      calendarSource,
      appConfigRepository,
    });

    await useCase.execute({ source: 'calendar', date: '2026-07-16' });

    expect(calendarSource.getEventsForDate).toHaveBeenCalledWith('2026-07-16', ['work', 'family']);
  });

  it('keeps denied mail access distinct from an empty inbox', async () => {
    const mailSource: IMailSource = {
      getUnreadMessages: vi.fn(async () => ({
        status: 'denied' as const,
        data: { unreadCount: 0, messages: [] },
        message: 'Access is blocked in macOS Automation settings.',
      })),
    };
    const useCase = new LoadDailyReviewIntegrationUseCase({ mailSource });

    const result = await useCase.execute({ source: 'mail' });

    expect(result).toEqual({
      source: 'mail',
      status: 'denied',
      mailUnreadCount: 0,
      mailMessages: [],
      message: 'Access is blocked in macOS Automation settings.',
    });
  });

  it('returns Apple Mail unread count without requiring message previews', async () => {
    const mailSource: IMailSource = {
      getUnreadMessages: vi.fn(async () => ({
        status: 'connected' as const,
        data: { unreadCount: 352, messages: [] },
      })),
    };
    const useCase = new LoadDailyReviewIntegrationUseCase({ mailSource });

    await expect(useCase.execute({ source: 'mail' })).resolves.toMatchObject({
      source: 'mail',
      status: 'connected',
      mailUnreadCount: 352,
      mailMessages: [],
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
