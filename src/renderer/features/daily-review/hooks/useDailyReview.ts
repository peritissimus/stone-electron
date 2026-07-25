/**
 * useDailyReview — reads the snapshot store, runs the initial load,
 * and subscribes to note/meeting events so the page stays fresh as
 * the user works in other surfaces.
 */

import { useCallback, useEffect } from 'react';
import { useDailyReviewStore } from '@renderer/features/daily-review/model/dailyReviewStore';
export type {
  DailyReviewIntegrationStates,
  IntegrationLoadState,
} from '@renderer/features/daily-review/model/dailyReviewStore';
import { useInvalidation } from '@renderer/services/invalidation/hooks/useInvalidation';

/** Auto-refresh at most this often. Note events can arrive in bursts (sync,
 *  indexing) or continuously (a live recording appending to today's journal
 *  fires note:updated every second), so an unthrottled "refresh per event"
 *  hammers the page with a full IPC round-trip each time. */
const REFRESH_THROTTLE_MS = 2000;

export function useDailyReview() {
  const snapshot = useDailyReviewStore((s) => s.snapshot);
  const loading = useDailyReviewStore((s) => s.loading);
  const loadedOnce = useDailyReviewStore((s) => s.loadedOnce);
  const refreshing = useDailyReviewStore((s) => s.refreshing);
  const error = useDailyReviewStore((s) => s.error);
  const integrations = useDailyReviewStore((s) => s.integrations);
  const loadIntegration = useDailyReviewStore((s) => s.loadIntegration);
  const load = useDailyReviewStore((s) => s.load);
  const refresh = useDailyReviewStore((s) => s.refresh);
  const loadIntegrations = useDailyReviewStore((s) => s.loadIntegrations);
  const summary = useDailyReviewStore((s) => s.summary);
  const summarizing = useDailyReviewStore((s) => s.summarizing);
  const summaryError = useDailyReviewStore((s) => s.summaryError);
  const summarize = useDailyReviewStore((s) => s.summarize);
  const clearSummary = useDailyReviewStore((s) => s.clearSummary);

  const reload = useCallback(async () => {
    await refresh();
    await loadIntegrations();
  }, [loadIntegrations, refresh]);

  useEffect(() => {
    if (!loadedOnce) void load();
  }, [load, loadedOnce]);

  // Any note write anywhere in the app may have changed today's captures /
  // journal / on-this-day — the invalidation module coalesces event bursts.
  useInvalidation({
    sources: ['note'],
    debounceMs: REFRESH_THROTTLE_MS,
    invalidate: () => refresh(),
  });

  return {
    snapshot,
    loading,
    loadedOnce,
    refreshing,
    error,
    integrations,
    retryIntegration: loadIntegration,
    reload,
    summary,
    summarizing,
    summaryError,
    summarize,
    clearSummary,
  };
}
