import { create } from 'zustand';
import type { TodoItem } from '@shared/types';
import { noteAPI } from '@renderer/api';
import {
  createWorkspaceCache,
  type WorkspaceCacheState,
} from '@renderer/services/stores/createWorkspaceCache';

export type TaskGroupBy = 'state' | 'notebook' | 'note' | 'none';

interface TaskState extends WorkspaceCacheState {
  todos: TodoItem[];
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

const cache = createWorkspaceCache<TaskState, TodoItem[]>({
  label: 'taskStore',
  load: () => noteAPI.getAllTodos(),
  apply: (todos) => ({ todos }),
  failureMessage: 'Failed to load tasks',
});

export const useTaskStore = create<TaskState>((set, get) => ({
  ...cache.initialState,
  todos: [],
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

  ensureLoaded: () => cache.ensureLoaded(set, get),
  refresh: (showLoading) => cache.refresh(set, get, showLoading),
}));
