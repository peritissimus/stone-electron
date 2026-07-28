import { create } from 'zustand';
import type { GraphData } from '@shared/types';
import { noteAPI } from '@renderer/api';
import {
  createWorkspaceCache,
  type WorkspaceCacheState,
} from '@renderer/services/stores/createWorkspaceCache';

interface GraphState extends WorkspaceCacheState {
  data: GraphData;
  showOrphans: boolean;
  setShowOrphans: (show: boolean) => void;
  ensureLoaded: () => Promise<void>;
  refresh: (showLoading?: boolean) => Promise<void>;
}

const cache = createWorkspaceCache<GraphState, GraphData>({
  label: 'graphStore',
  load: () => noteAPI.getGraphData(),
  apply: (data) => ({ data: { nodes: data.nodes ?? [], links: data.links ?? [] } }),
  failureMessage: 'Failed to load graph',
});

export const useGraphStore = create<GraphState>((set, get) => ({
  ...cache.initialState,
  data: { nodes: [], links: [] },
  showOrphans: true,
  setShowOrphans: (showOrphans) => set({ showOrphans }),

  ensureLoaded: () => cache.ensureLoaded(set, get),
  refresh: (showLoading) => cache.refresh(set, get, showLoading),
}));
