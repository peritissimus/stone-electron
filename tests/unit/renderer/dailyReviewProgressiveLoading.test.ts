import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyReviewSnapshot } from '../../../src/shared/types';

const get = vi.fn();
const loadIntegration = vi.fn();
const loadIntegrations = vi.fn();

vi.mock('@renderer/api', () => ({
  dailyReviewAPI: {
    get,
    loadIntegration,
    loadIntegrations,
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
    loadIntegrations.mockImplementation(() => new Promise(() => undefined));

    await useDailyReviewStore.getState().load();

    expect(useDailyReviewStore.getState()).toMatchObject({
      loadedOnce: true,
      loading: false,
      snapshot: { todayJournal: { contentPreview: 'Local data is ready.' } },
    });
    await vi.waitFor(() => expect(loadIntegrations).toHaveBeenCalledOnce());
    expect(loadIntegration).not.toHaveBeenCalled();
    expect(useDailyReviewStore.getState().integrations.mail.status).toBe('loading');
  });

  it('preserves denied access as an actionable state', async () => {
    useDailyReviewStore.setState({ snapshot: snapshot() });
    loadIntegration.mockResolvedValue({
      success: true,
      data: {
        result: {
          source: 'calendar',
          status: 'denied',
          data: { events: [] },
          message: 'Access is blocked in macOS Automation settings.',
        },
        snapshot: null,
      },
    });

    await useDailyReviewStore.getState().loadIntegration('calendar');

    expect(useDailyReviewStore.getState().integrations.calendar).toEqual({
      status: 'denied',
      message: 'Access is blocked in macOS Automation settings.',
    });
  });

  it('stores a Mail unread count even when Apple Mail supplies no previews', async () => {
    useDailyReviewStore.setState({ snapshot: snapshot() });
    loadIntegration.mockResolvedValue({
      success: true,
      data: {
        result: {
          source: 'mail',
          status: 'connected',
          data: { unreadCount: 352, messages: [] },
        },
        snapshot: { ...snapshot(), mailUnreadCount: 352, mailMessages: [] },
      },
    });

    await useDailyReviewStore.getState().loadIntegration('mail');

    expect(useDailyReviewStore.getState().snapshot).toMatchObject({
      mailUnreadCount: 352,
      mailMessages: [],
    });
    // The load carried the day it belongs in, so collecting the count costs no
    // second read. Re-reading here is what the old sequence did, and it only
    // worked while the main process still held the data in cache.
    expect(get).not.toHaveBeenCalled();
  });

  it('leaves the loaded day alone when a transport has no sources to merge', async () => {
    useDailyReviewStore.setState({ snapshot: snapshot() });
    loadIntegration.mockResolvedValue({
      success: true,
      data: {
        result: { source: 'linear', status: 'unavailable', data: { issues: [] } },
        snapshot: null,
      },
    });

    await useDailyReviewStore.getState().loadIntegration('linear');

    expect(useDailyReviewStore.getState().snapshot).toMatchObject({
      todayJournal: { contentPreview: 'Local data is ready.' },
    });
    expect(useDailyReviewStore.getState().integrations.linear.status).toBe('unavailable');
  });
});
