/**
 * useDailyReview — reads the snapshot store, runs the initial load,
 * and subscribes to note/meeting events so the page stays fresh as
 * the user works in other surfaces.
 */

import { useEffect } from 'react';
import { useDailyReviewStore } from '@renderer/stores/dailyReviewStore';
import { useNoteEvents } from '@renderer/hooks/useNoteEvents';

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

  // Any note write anywhere in the app may have changed today's
  // captures / journal / on-this-day — refresh quietly in the
  // background.
  useNoteEvents({
    onCreated: () => void refresh(),
    onUpdated: () => void refresh(),
    onDeleted: () => void refresh(),
  });

  return { snapshot, loading, loadedOnce, refreshing, error, reload: refresh };
}
