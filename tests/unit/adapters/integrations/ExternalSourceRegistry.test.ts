import { describe, expect, it, vi } from 'vitest';
import { ExternalSourceRegistry } from '../../../../src/main/adapters/out/integrations/ExternalSourceRegistry';
import type {
  DailyReviewExternalResult,
  ExternalSourceId,
  IAppConfigRepository,
  IExternalSource,
} from '../../../../src/main/domain';
import { DEFAULT_APP_CONFIG } from '../../../../src/main/domain/value-objects/AppConfig';

function source(
  id: ExternalSourceId,
  order: string[],
  result: DailyReviewExternalResult,
): IExternalSource {
  return {
    source: id,
    load: vi.fn(async () => {
      order.push(id);
      return result;
    }),
  };
}

function configRepository(): IAppConfigRepository {
  return {
    get: vi.fn(async () => DEFAULT_APP_CONFIG),
    set: vi.fn(),
    update: vi.fn(),
  } as unknown as IAppConfigRepository;
}

function snapshot(date = '2026-07-25') {
  return {
    date,
    todayJournal: { date, exists: false, noteId: null, contentPreview: null },
    todayMeetings: [],
    openTasks: [],
    recentNotes: [],
    onThisDay: [],
  };
}

describe('ExternalSourceRegistry', () => {
  it('owns deterministic load ordering and snapshot merging', async () => {
    const order: string[] = [];
    const registry = new ExternalSourceRegistry({
      appConfigRepository: configRepository(),
      sources: [
        source('calendar', order, {
          source: 'calendar',
          status: 'connected',
          data: { events: [] },
        }),
        source('mail', order, {
          source: 'mail',
          status: 'connected',
          data: { unreadCount: 4, messages: [] },
        }),
        source('linear', order, {
          source: 'linear',
          status: 'connected',
          data: {
            issues: [
              {
                identifier: 'ENG-1',
                title: 'Ship',
                state: 'Doing',
                priority: 1,
                url: 'https://linear.app/issue/ENG-1',
                dueDate: null,
              },
            ],
          },
        }),
      ],
    });

    await registry.loadAll({ date: '2026-07-25' });

    expect(order).toEqual(['linear', 'mail', 'calendar']);
    expect(registry.mergeInto(snapshot())).toMatchObject({
      mailUnreadCount: 4,
      linearIssues: [{ identifier: 'ENG-1' }],
      calendarEvents: [],
    });
  });

  it('drops stale cached source data from snapshots', async () => {
    let now = 1_000;
    const registry = new ExternalSourceRegistry({
      appConfigRepository: configRepository(),
      sources: [
        source('mail', [], {
          source: 'mail',
          status: 'connected',
          data: { unreadCount: 2, messages: [] },
        }),
      ],
      now: () => now,
    });

    await registry.load('mail', { date: '2026-07-25' });
    now += 6 * 60_000;

    expect(registry.mergeInto(snapshot())).not.toHaveProperty('mailUnreadCount');
  });
});
