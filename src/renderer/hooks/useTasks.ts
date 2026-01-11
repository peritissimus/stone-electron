/**
 * useTasks Hook - Manages task filtering, grouping, and state
 *
 * Follows architecture: Components → Hooks → Stores/API
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { TodoItem } from '@shared/types';
import { useFileEvents } from '@renderer/hooks/useFileEvents';
import { useNoteEvents } from '@renderer/hooks/useNoteEvents';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { logger } from '@renderer/utils/logger';

// State configuration in priority order
export const TASK_STATES: readonly { key: string; label: string; done: boolean; color: string }[] = [
  { key: 'doing', label: 'DOING', done: false, color: 'bg-blue-500' },
  { key: 'waiting', label: 'WAITING', done: false, color: 'bg-yellow-500' },
  { key: 'todo', label: 'TODO', done: false, color: 'bg-gray-400' },
  { key: 'hold', label: 'HOLD', done: false, color: 'bg-orange-500' },
  { key: 'idea', label: 'IDEA', done: false, color: 'bg-purple-500' },
  { key: 'done', label: 'DONE', done: true, color: 'bg-green-500' },
  { key: 'canceled', label: 'CANCELED', done: true, color: 'bg-gray-300' },
];

export type GroupByOption = 'state' | 'notebook' | 'note' | 'none';

export interface TaskCounts {
  active: number;
  completed: number;
  total: number;
  visible: number;
}

/**
 * Hook for loading and refreshing tasks
 */
function useTaskLoader() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { getAllTodos } = useNoteAPI();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTodos = useCallback(
    async (showLoadingState = true) => {
      try {
        if (showLoadingState) setLoading(true);
        const data = await getAllTodos();
        if (Array.isArray(data)) {
          setTodos(data);
        }
      } catch (error) {
        logger.error('[useTasks] Failed to load todos', { error });
      } finally {
        if (showLoadingState) setLoading(false);
      }
    },
    [getAllTodos],
  );

  const debouncedRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      loadTodos(false);
    }, 500);
  }, [loadTodos]);

  // Initial load
  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  // Auto-refresh on events
  useNoteEvents({ onUpdated: debouncedRefresh });
  useFileEvents({ onChanged: debouncedRefresh });

  return { todos, setTodos, loading };
}

/**
 * Hook for task filtering state
 */
function useTaskFilters() {
  const [searchQuery, setSearchQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [visibleStates, setVisibleStates] = useState<Set<string>>(
    () => new Set(TASK_STATES.filter((s) => !s.done).map((s) => s.key)),
  );
  const [groupBy, setGroupBy] = useState<GroupByOption>('state');

  const toggleStateVisibility = useCallback((stateKey: string) => {
    setVisibleStates((prev) => {
      const next = new Set(prev);
      if (next.has(stateKey)) {
        next.delete(stateKey);
      } else {
        next.add(stateKey);
      }
      return next;
    });
  }, []);

  const selectAllStates = useCallback(() => {
    setVisibleStates(new Set(TASK_STATES.map((s) => s.key)));
  }, []);

  const selectActiveStates = useCallback(() => {
    setVisibleStates(new Set(TASK_STATES.filter((s) => !s.done).map((s) => s.key)));
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    folderFilter,
    setFolderFilter,
    visibleStates,
    toggleStateVisibility,
    selectAllStates,
    selectActiveStates,
    groupBy,
    setGroupBy,
  };
}

/**
 * Hook for task toggle with optimistic updates
 */
export function useTaskToggle(
  setTodos: React.Dispatch<React.SetStateAction<TodoItem[]>>,
) {
  const [togglingTodoId, setTogglingTodoId] = useState<string | null>(null);
  const { updateTaskState } = useNoteAPI();

  const handleToggleTask = useCallback(
    async (todo: TodoItem, newState: string) => {
      const parts = todo.id.split('-');
      const taskIndex = parseInt(parts[parts.length - 1], 10);

      if (isNaN(taskIndex)) {
        logger.error('[useTasks] Invalid task index', { todoId: todo.id });
        return;
      }

      setTogglingTodoId(todo.id);
      const previousState = todo.state;
      const previousChecked = todo.checked;

      // Optimistic update
      setTodos((prev) =>
        prev.map((t) =>
          t.id === todo.id
            ? { ...t, state: newState as TodoItem['state'], checked: newState === 'done' }
            : t,
        ),
      );

      try {
        const success = await updateTaskState(todo.noteId, taskIndex, newState);
        if (!success) {
          // Revert on failure
          setTodos((prev) =>
            prev.map((t) =>
              t.id === todo.id ? { ...t, state: previousState, checked: previousChecked } : t,
            ),
          );
          logger.error('[useTasks] Failed to update task state');
        }
      } catch (error) {
        // Revert on error
        setTodos((prev) =>
          prev.map((t) =>
            t.id === todo.id ? { ...t, state: previousState, checked: previousChecked } : t,
          ),
        );
        logger.error('[useTasks] Failed to toggle task', { error });
      } finally {
        setTogglingTodoId(null);
      }
    },
    [setTodos, updateTaskState],
  );

  return { togglingTodoId, handleToggleTask };
}

/**
 * Main useTasks hook - combines all task management functionality
 */
export function useTasks() {
  const { todos, setTodos, loading } = useTaskLoader();
  const filters = useTaskFilters();
  const { togglingTodoId, handleToggleTask } = useTaskToggle(setTodos);

  const { searchQuery, folderFilter, visibleStates, groupBy } = filters;

  // Extract unique folders
  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const todo of todos) {
      if (todo.notePath) {
        const parts = todo.notePath.replace(/\\/g, '/').split('/');
        if (parts.length > 1) {
          set.add(parts[0]);
        }
      }
    }
    return Array.from(set).sort();
  }, [todos]);

  // Filter todos
  const filteredTodos = useMemo(() => {
    return todos.filter((todo) => {
      const matchesSearch =
        !searchQuery || todo.text.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFolder = folderFilter === 'all' || todo.notePath?.startsWith(folderFilter);
      const matchesState = visibleStates.has(todo.state);
      return matchesSearch && matchesFolder && matchesState;
    });
  }, [todos, searchQuery, folderFilter, visibleStates]);

  // Group todos
  const groupedTodos = useMemo(() => {
    const groups: Record<string, TodoItem[]> = {};

    if (groupBy === 'state') {
      for (const state of TASK_STATES) {
        if (visibleStates.has(state.key)) {
          groups[state.key] = [];
        }
      }
      for (const todo of filteredTodos) {
        if (groups[todo.state]) {
          groups[todo.state].push(todo);
        }
      }
    } else if (groupBy === 'notebook') {
      for (const todo of filteredTodos) {
        const parts = todo.notePath?.replace(/\\/g, '/').split('/') || [];
        const notebook = parts[0] || 'Uncategorized';
        if (!groups[notebook]) groups[notebook] = [];
        groups[notebook].push(todo);
      }
    } else if (groupBy === 'note') {
      for (const todo of filteredTodos) {
        const noteKey = todo.noteTitle || 'Untitled';
        if (!groups[noteKey]) groups[noteKey] = [];
        groups[noteKey].push(todo);
      }
    } else {
      groups['all'] = filteredTodos;
    }

    return groups;
  }, [filteredTodos, groupBy, visibleStates]);

  // Calculate counts
  const counts = useMemo<TaskCounts>(() => {
    const filtered = todos.filter((todo) => {
      const matchesSearch =
        !searchQuery || todo.text.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFolder = folderFilter === 'all' || todo.notePath?.startsWith(folderFilter);
      return matchesSearch && matchesFolder;
    });

    let active = 0;
    let completed = 0;

    for (const todo of filtered) {
      if (todo.state === 'done' || todo.state === 'canceled') {
        completed++;
      } else {
        active++;
      }
    }

    return { active, completed, total: filtered.length, visible: filteredTodos.length };
  }, [todos, searchQuery, folderFilter, filteredTodos]);

  return {
    // Data
    todos,
    loading,
    filteredTodos,
    groupedTodos,
    counts,
    folders,
    // Filters
    ...filters,
    // Actions
    togglingTodoId,
    handleToggleTask,
  };
}
