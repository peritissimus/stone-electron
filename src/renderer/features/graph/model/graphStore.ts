import { create } from 'zustand';
import type { GraphData } from '@shared/types';
import { noteAPI } from '@renderer/api';
import { useWorkspaceStore } from '@renderer/services/workspace/model/workspaceStore';
import { logger } from '@renderer/services/telemetry/logger';

interface GraphState {
  data: GraphData;
  workspaceId: string | null;
  loaded: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  showOrphans: boolean;
  setShowOrphans: (show: boolean) => void;
  ensureLoaded: () => Promise<void>;
  refresh: (showLoading?: boolean) => Promise<void>;
}

let pendingLoad: Promise<void> | null = null;
let pendingWorkspaceId: string | null = null;

export const useGraphStore = create<GraphState>((set, get) => ({
  data: { nodes: [], links: [] },
  workspaceId: null,
  loaded: false,
  loading: false,
  refreshing: false,
  error: null,
  showOrphans: true,
  setShowOrphans: (showOrphans) => set({ showOrphans }),

  ensureLoaded: async () => {
    const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;
    const state = get();
    if (state.loaded && state.workspaceId === workspaceId) return;
    await state.refresh(true);
  },

  refresh: async (showLoading = false) => {
    const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;
    if (pendingLoad) {
      if (pendingWorkspaceId === workspaceId) return pendingLoad;
      await pendingLoad;
      return get().refresh(showLoading);
    }

    pendingWorkspaceId = workspaceId;
    set({
      loading: showLoading && !get().loaded,
      refreshing: !showLoading || get().loaded,
      error: null,
    });

    pendingLoad = (async () => {
      try {
        const response = await noteAPI.getGraphData();
        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Failed to load graph');
        }
        if (useWorkspaceStore.getState().activeWorkspaceId === workspaceId) {
          set({
            data: {
              nodes: response.data.nodes ?? [],
              links: response.data.links ?? [],
            },
            workspaceId,
            loaded: true,
          });
        }
      } catch (error) {
        logger.error('[graphStore] Failed to load graph', { error });
        set({ error: error instanceof Error ? error.message : 'Failed to load graph' });
      } finally {
        set({ loading: false, refreshing: false });
        pendingLoad = null;
        pendingWorkspaceId = null;
      }
    })();

    return pendingLoad;
  },
}));
