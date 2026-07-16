import { create } from 'zustand';
import type { TodoItem } from '@shared/types';
import { noteAPI } from '@renderer/api';
import { useWorkspaceStore } from '@renderer/services/workspace/model/workspaceStore';
import { logger } from '@renderer/services/telemetry/logger';

export type TaskGroupBy = 'state' | 'notebook' | 'note' | 'none';

interface TaskState {
  todos: TodoItem[];
  workspaceId: string | null;
  loaded: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  searchQuery: string;
  folderFilter: string;
  visibleStates: Set<string>;
  groupBy: TaskGroupBy;
  setTodos: (updater: TodoItem[] | ((todos: TodoItem[]) => TodoItem[])) => void;
  setSearchQuery: (query: string) => void;
  setFolderFilter: (folder: string) => void;
  setVisibleStates: (states: Set<string>) => void;
  setGroupBy: (groupBy: TaskGroupBy) => void;
  ensureLoaded: () => Promise<void>;
  refresh: (showLoading?: boolean) => Promise<void>;
}

let pendingLoad: Promise<void> | null = null;
let pendingWorkspaceId: string | null = null;

export const useTaskStore = create<TaskState>((set, get) => ({
  todos: [],
  workspaceId: null,
  loaded: false,
  loading: false,
  refreshing: false,
  error: null,
  searchQuery: '',
  folderFilter: 'all',
  visibleStates: new Set(['doing', 'waiting', 'todo', 'hold', 'idea']),
  groupBy: 'state',

  setTodos: (updater) =>
    set((state) => ({
      todos: typeof updater === 'function' ? updater(state.todos) : updater,
    })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFolderFilter: (folderFilter) => set({ folderFilter }),
  setVisibleStates: (visibleStates) => set({ visibleStates }),
  setGroupBy: (groupBy) => set({ groupBy }),

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
        const response = await noteAPI.getAllTodos();
        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Failed to load tasks');
        }
        if (useWorkspaceStore.getState().activeWorkspaceId === workspaceId) {
          set({ todos: response.data, workspaceId, loaded: true });
        }
      } catch (error) {
        logger.error('[taskStore] Failed to load tasks', { error });
        set({ error: error instanceof Error ? error.message : 'Failed to load tasks' });
      } finally {
        set({ loading: false, refreshing: false });
        pendingLoad = null;
        pendingWorkspaceId = null;
      }
    })();

    return pendingLoad;
  },
}));
