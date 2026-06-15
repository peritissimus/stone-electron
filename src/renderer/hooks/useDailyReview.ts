/**
 * useDailyReview — reads the snapshot store, runs the initial load,
 * and subscribes to note/meeting events so the page stays fresh as
 * the user works in other surfaces.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useDailyReviewStore } from '@renderer/stores/dailyReviewStore';
import { useNoteEvents } from '@renderer/hooks/useNoteEvents';

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
  const load = useDailyReviewStore((s) => s.load);
  const refresh = useDailyReviewStore((s) => s.refresh);

  useEffect(() => {
    if (!loadedOnce) void load();
  }, [load, loadedOnce]);

  // Leading + trailing throttle: refresh immediately on the first event, then
  // coalesce any further events into a single refresh at the window boundary —
  // so continuous note churn refreshes ~once per window instead of per event.
  const lastRefreshRef = useRef(0);
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const throttledRefresh = useCallback(() => {
    const elapsed = Date.now() - lastRefreshRef.current;
    if (elapsed >= REFRESH_THROTTLE_MS) {
      lastRefreshRef.current = Date.now();
      void refresh();
      return;
    }
    if (trailingTimerRef.current) return; // one trailing refresh already queued
    trailingTimerRef.current = setTimeout(() => {
      trailingTimerRef.current = null;
      lastRefreshRef.current = Date.now();
      void refresh();
    }, REFRESH_THROTTLE_MS - elapsed);
  }, [refresh]);

  useEffect(
    () => () => {
      if (trailingTimerRef.current) clearTimeout(trailingTimerRef.current);
    },
    [],
  );

  // Any note write anywhere in the app may have changed today's captures /
  // journal / on-this-day — refresh quietly in the background (throttled).
  useNoteEvents({
    onCreated: throttledRefresh,
    onUpdated: throttledRefresh,
    onDeleted: throttledRefresh,
  });

  return { snapshot, loading, loadedOnce, refreshing, error, reload: refresh };
}
