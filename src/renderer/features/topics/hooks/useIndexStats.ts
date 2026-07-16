import { useEffect } from 'react';
import { toast } from 'sonner';
import { useIndexStatsStore } from '@renderer/features/topics/model/indexStatsStore';

export function useIndexStats() {
  const stats = useIndexStatsStore((s) => s.stats);
  const loading = useIndexStatsStore((s) => s.loading);
  const rebuilding = useIndexStatsStore((s) => s.rebuilding);
  const error = useIndexStatsStore((s) => s.error);
  const refresh = useIndexStatsStore((s) => s.refresh);
  const rebuildAllRaw = useIndexStatsStore((s) => s.rebuildAll);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rebuildAll = async (force = false) => {
    const before = stats?.indexedNotes ?? 0;
    await rebuildAllRaw(force);
    const refreshedStats = useIndexStatsStore.getState().stats;
    const after = refreshedStats?.indexedNotes ?? 0;
    const remainingFailures = refreshedStats?.failedNotes ?? 0;
    const delta = after - before;
    if (remainingFailures > 0) {
      toast.error(
        `${remainingFailures} note${remainingFailures === 1 ? '' : 's'} still couldn’t be indexed`,
        { description: 'Check that the local embedding worker is available, then try again.' },
      );
      return;
    }
    if (delta > 0) {
      toast.success(`Index rebuilt — ${delta} note${delta === 1 ? '' : 's'} indexed`);
    } else if (force) {
      toast.success(`Index rebuilt — ${after} notes refreshed`);
    } else {
      toast.success('Index is up to date');
    }
  };

  return { stats, loading, rebuilding, error, refresh, rebuildAll };
}
