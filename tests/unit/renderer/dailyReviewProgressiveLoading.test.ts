import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyReviewSnapshot } from '../../../src/shared/types';

const get = vi.fn();
const loadIntegration = vi.fn();

vi.mock('@renderer/api', () => ({
  dailyReviewAPI: {
    get,
    loadIntegration,
    summarize: vi.fn(),
  },
}));

const { useDailyReviewStore } =
  await import('../../../src/renderer/features/daily-review/model/dailyReviewStore');

function snapshot(): DailyReviewSnapshot {
  return {
    date: '2026-07-16',
    todayJournal: {
      date: '2026-07-16',
      exists: true,
      noteId: 'journal-1',
      contentPreview: 'Local data is ready.',
    },
    todayMeetings: [],
    openTasks: [],
    recentNotes: [],
    onThisDay: [],
  };
}

describe('dailyReviewStore progressive integration loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDailyReviewStore.getState().reset();
  });

  it('makes local Today data usable without waiting for external applications', async () => {
    get.mockResolvedValue({ success: true, data: snapshot() });
    loadIntegration.mockImplementation(({ source }: { source: string }) =>
      source === 'linear'
        ? Promise.resolve({
            success: true,
            data: { source: 'linear', status: 'connected', linearIssues: [] },
          })
        : new Promise(() => undefined),
    );

    await useDailyReviewStore.getState().load();

    expect(useDailyReviewStore.getState()).toMatchObject({
      loadedOnce: true,
      loading: false,
      snapshot: { todayJournal: { contentPreview: 'Local data is ready.' } },
    });
    await vi.waitFor(() => expect(loadIntegration).toHaveBeenCalledTimes(2));
    expect(useDailyReviewStore.getState().integrations.mail.status).toBe('loading');
  });

  it('preserves denied access as an actionable state', async () => {
    useDailyReviewStore.setState({ snapshot: snapshot() });
    loadIntegration.mockResolvedValue({
      success: true,
      data: {
        source: 'calendar',
        status: 'denied',
        calendarEvents: [],
        message: 'Access is blocked in macOS Automation settings.',
      },
    });

    await useDailyReviewStore.getState().loadIntegration('calendar');

    expect(useDailyReviewStore.getState().integrations.calendar).toEqual({
      status: 'denied',
      message: 'Access is blocked in macOS Automation settings.',
    });
  });
});
