/**
 * dailyReviewStore — fetches + caches today's snapshot. Single source
 * of truth for the /today page. Soft-refresh on every note/meeting
 * event so the page reflects writes that happened elsewhere in the app.
 */

import { create } from 'zustand';
import { dailyReviewAPI } from '@renderer/api';
import { logger } from '@renderer/lib/logger';
import type { DailyReviewSnapshot } from '@shared/types';

interface DailyReviewState {
  snapshot: DailyReviewSnapshot | null;
  loading: boolean;
  loadedOnce: boolean;
  /** Background refresh — separate from initial-load loading so the UI
   *  can keep showing stale data while a refresh is in flight. */
  refreshing: boolean;
  error: string | null;

  /** On-demand AI day summary. */
  summary: string | null;
  summarizing: boolean;
  summaryError: string | null;

  load: () => Promise<void>;
  refresh: () => Promise<void>;
  summarize: (saveToJournal: boolean) => Promise<void>;
  clearSummary: () => void;
  reset: () => void;
}

let inFlight: Promise<void> | null = null;

export const useDailyReviewStore = create<DailyReviewState>((set, get) => ({
  snapshot: null,
  loading: false,
  loadedOnce: false,
  refreshing: false,
  error: null,
  summary: null,
  summarizing: false,
  summaryError: null,

  load: async () => {
    if (get().loadedOnce) return;
    set({ loading: true, error: null });
    try {
      const response = await dailyReviewAPI.get();
      if (!response.success || !response.data) {
        set({
          loading: false,
          loadedOnce: true,
          error: response.error?.message ?? 'Failed to load today',
        });
        return;
      }
      set({ snapshot: response.data, loading: false, loadedOnce: true, error: null });
    } catch (err) {
      logger.error('[dailyReviewStore] load failed', err);
      set({
        loading: false,
        loadedOnce: true,
        error: err instanceof Error ? err.message : 'Failed to load today',
      });
    }
  },

  refresh: async () => {
    // De-dupe concurrent refreshes (note + meeting events can fire in bursts).
    if (inFlight) return inFlight;
    set({ refreshing: true });
    inFlight = (async () => {
      try {
        const response = await dailyReviewAPI.get();
        if (response.success && response.data) {
          set({ snapshot: response.data, refreshing: false, error: null });
        } else {
          set({ refreshing: false });
        }
      } catch (err) {
        logger.warn('[dailyReviewStore] refresh failed', err);
        set({ refreshing: false });
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  },

  summarize: async (saveToJournal) => {
    set({ summarizing: true, summaryError: null });
    try {
      const response = await dailyReviewAPI.summarize({ saveToJournal });
      if (response.success && response.data) {
        set({ summary: response.data.summary, summarizing: false, summaryError: null });
        // Saving to the journal changes today's snapshot — pull it back in.
        if (saveToJournal) void get().refresh();
      } else {
        set({
          summarizing: false,
          summaryError: response.error?.message ?? 'Failed to summarize today',
        });
      }
    } catch (err) {
      logger.warn('[dailyReviewStore] summarize failed', err);
      set({
        summarizing: false,
        summaryError: err instanceof Error ? err.message : 'Failed to summarize today',
      });
    }
  },

  clearSummary: () => set({ summary: null, summaryError: null }),

  reset: () =>
    set({
      snapshot: null,
      loading: false,
      loadedOnce: false,
      refreshing: false,
      error: null,
      summary: null,
      summarizing: false,
      summaryError: null,
    }),
}));
