/**
 * Index stats store — drives the Knowledge page's "indexed" pill and the
 * IndexStatusCard. Counts come from note_index_records via index:getStats.
 */

import { create } from 'zustand';
import { indexAPI, type IndexStatsDTO } from '@renderer/api';

interface IndexStatsState {
  stats: IndexStatsDTO | null;
  loading: boolean;
  rebuilding: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  rebuildAll: (force?: boolean) => Promise<void>;
}

export const useIndexStatsStore = create<IndexStatsState>((set, get) => ({
  stats: null,
  loading: false,
  rebuilding: false,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null });
    const res = await indexAPI.getStats();
    if (res.success && res.data) {
      set({ stats: res.data, loading: false });
    } else {
      set({ loading: false, error: res.error?.message ?? 'Failed to load index stats' });
    }
  },

  rebuildAll: async (force = false) => {
    if (get().rebuilding) return;
    set({ rebuilding: true, error: null });
    try {
      const res = await indexAPI.rebuildAll(undefined, force);
      if (!res.success) {
        set({
          rebuilding: false,
          error: res.error?.message ?? 'Reindex failed',
        });
        return;
      }
      // Refresh stats after a rebuild
      const stats = await indexAPI.getStats();
      if (stats.success && stats.data) {
        set({ stats: stats.data, rebuilding: false });
      } else {
        set({ rebuilding: false });
      }
    } catch (err) {
      set({
        rebuilding: false,
        error: err instanceof Error ? err.message : 'Reindex failed',
      });
    }
  },
}));
