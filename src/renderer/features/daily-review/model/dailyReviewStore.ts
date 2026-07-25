/**
 * dailyReviewStore — fetches + caches today's snapshot. Single source
 * of truth for the /today page. Soft-refresh on every note/meeting
 * event so the page reflects writes that happened elsewhere in the app.
 */

import { create } from 'zustand';
import { dailyReviewAPI } from '@renderer/api';
import { logger } from '@renderer/services/telemetry/logger';
import type {
  DailyReviewIntegrationSource,
  DailyReviewIntegrationStatus,
  DailyReviewSnapshot,
} from '@shared/types';

export interface IntegrationLoadState {
  status: 'idle' | 'loading' | DailyReviewIntegrationStatus;
  message: string | null;
}

export type DailyReviewIntegrationStates = Record<
  DailyReviewIntegrationSource,
  IntegrationLoadState
>;

interface DailyReviewState {
  snapshot: DailyReviewSnapshot | null;
  loading: boolean;
  loadedOnce: boolean;
  /** Background refresh — separate from initial-load loading so the UI
   *  can keep showing stale data while a refresh is in flight. */
  refreshing: boolean;
  error: string | null;
  integrations: DailyReviewIntegrationStates;

  /** On-demand AI day summary. */
  summary: string | null;
  summarizing: boolean;
  summaryError: string | null;

  load: () => Promise<void>;
  refresh: () => Promise<void>;
  loadIntegration: (source: DailyReviewIntegrationSource) => Promise<void>;
  loadIntegrations: () => Promise<void>;
  summarize: (saveToJournal: boolean) => Promise<void>;
  clearSummary: () => void;
  reset: () => void;
}

let inFlight: Promise<void> | null = null;
const integrationInFlight: Partial<Record<DailyReviewIntegrationSource, Promise<void>>> = {};

const initialIntegrations = (): DailyReviewIntegrationStates => ({
  calendar: { status: 'idle', message: null },
  mail: { status: 'idle', message: null },
  linear: { status: 'idle', message: null },
});

export const useDailyReviewStore = create<DailyReviewState>((set, get) => ({
  snapshot: null,
  loading: false,
  loadedOnce: false,
  refreshing: false,
  error: null,
  integrations: initialIntegrations(),
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
      void get().loadIntegrations();
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
          const nextSnapshot = response.data;
          set({
            snapshot: nextSnapshot,
            refreshing: false,
            error: null,
          });
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

  loadIntegration: async (source) => {
    const existing = integrationInFlight[source];
    if (existing) return existing;

    const request = (async () => {
      set((state) => ({
        integrations: {
          ...state.integrations,
          [source]: { ...state.integrations[source], status: 'loading', message: null },
        },
      }));

      try {
        const response = await dailyReviewAPI.loadIntegration({
          source,
          date: get().snapshot?.date,
        });
        if (!response.success || !response.data) {
          setIntegrationFailure(set, source, response.error?.message ?? 'Could not check access.');
          return;
        }
        const result = response.data;
        set((state) => ({
          integrations: {
            ...state.integrations,
            [source]: { status: result.status, message: result.message ?? null },
          },
        }));
        await get().refresh();
      } catch (err) {
        setIntegrationFailure(
          set,
          source,
          err instanceof Error ? err.message : 'Could not check access.',
        );
      }
    })();

    integrationInFlight[source] = request;
    try {
      await request;
    } finally {
      delete integrationInFlight[source];
    }
  },

  loadIntegrations: async () => {
    set((state) => ({
      integrations: Object.fromEntries(
        Object.entries(state.integrations).map(([source, integration]) => [
          source,
          { ...integration, status: 'loading', message: null },
        ]),
      ) as DailyReviewIntegrationStates,
    }));

    try {
      // The main process owns source ordering, TCC serialization, and caching.
      const response = await dailyReviewAPI.loadIntegrations({
        date: get().snapshot?.date,
      });
      if (!response.success || !response.data) {
        const message = response.error?.message ?? 'Could not check integrations.';
        for (const source of ['calendar', 'mail', 'linear'] as const) {
          setIntegrationFailure(set, source, message);
        }
        return;
      }
      set((state) => ({
        integrations: response.data!.reduce(
          (integrations, result) => ({
            ...integrations,
            [result.source]: {
              status: result.status,
              message: result.message ?? null,
            },
          }),
          state.integrations,
        ),
      }));
      await get().refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not check integrations.';
      for (const source of ['calendar', 'mail', 'linear'] as const) {
        setIntegrationFailure(set, source, message);
      }
    }
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

  reset: () => {
    for (const source of ['calendar', 'mail', 'linear'] as const) {
      delete integrationInFlight[source];
    }
    set({
      snapshot: null,
      loading: false,
      loadedOnce: false,
      refreshing: false,
      error: null,
      integrations: initialIntegrations(),
      summary: null,
      summarizing: false,
      summaryError: null,
    });
  },
}));

function setIntegrationFailure(
  set: (
    update: Partial<DailyReviewState> | ((state: DailyReviewState) => Partial<DailyReviewState>),
  ) => void,
  source: DailyReviewIntegrationSource,
  message: string,
): void {
  set((state) => ({
    integrations: {
      ...state.integrations,
      [source]: { status: 'error', message },
    },
  }));
}
