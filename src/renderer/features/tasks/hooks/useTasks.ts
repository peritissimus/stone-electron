import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TodoItem } from '@shared/types';
import { useNoteAPI } from '@renderer/features/notes/commands/useNoteAPI';
import { useTaskStore, type TaskGroupBy } from '@renderer/features/tasks/model/taskStore';
import { logger } from '@renderer/services/telemetry/logger';
import { useInvalidation } from '@renderer/services/invalidation/hooks/useInvalidation';
import { useWorkspaceStore } from '@renderer/services/workspace/model/workspaceStore';

export const TASK_STATES: readonly { key: string; label: string; done: boolean; color: string }[] =
  [
    { key: 'doing', label: 'DOING', done: false, color: 'bg-blue-500' },
    { key: 'waiting', label: 'WAITING', done: false, color: 'bg-yellow-500' },
    { key: 'todo', label: 'TODO', done: false, color: 'bg-gray-400' },
    { key: 'hold', label: 'HOLD', done: false, color: 'bg-orange-500' },
    { key: 'idea', label: 'IDEA', done: false, color: 'bg-purple-500' },
    { key: 'done', label: 'DONE', done: true, color: 'bg-green-500' },
    { key: 'canceled', label: 'CANCELED', done: true, color: 'bg-gray-300' },
  ];

export type GroupByOption = TaskGroupBy;

export interface TaskCounts {
  active: number;
  completed: number;
  total: number;
  visible: number;
}

export function useTasks() {
  const todos = useTaskStore((state) => state.todos);
  const loading = useTaskStore((state) => state.loading);
  const searchQuery = useTaskStore((state) => state.searchQuery);
  const folderFilter = useTaskStore((state) => state.folderFilter);
  const visibleStates = useTaskStore((state) => state.visibleStates);
  const groupBy = useTaskStore((state) => state.groupBy);
  const setTodos = useTaskStore((state) => state.setTodos);
  const setSearchQuery = useTaskStore((state) => state.setSearchQuery);
  const setFolderFilter = useTaskStore((state) => state.setFolderFilter);
  const setVisibleStates = useTaskStore((state) => state.setVisibleStates);
  const setGroupBy = useTaskStore((state) => state.setGroupBy);
  const ensureLoaded = useTaskStore((state) => state.ensureLoaded);
  const refresh = useTaskStore((state) => state.refresh);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const { updateTaskState } = useNoteAPI();
  const [togglingTodoId, setTogglingTodoId] = useState<string | null>(null);

  useEffect(() => {
    void ensureLoaded();
  }, [activeWorkspaceId, ensureLoaded]);

  useInvalidation({
    sources: ['note', 'file'],
    actions: ['updated', 'changed'],
    debounceMs: 500,
    invalidate: () => refresh(false),
  });

  const toggleStateVisibility = useCallback(
    (stateKey: string) => {
      const next = new Set(visibleStates);
      next.has(stateKey) ? next.delete(stateKey) : next.add(stateKey);
      setVisibleStates(next);
    },
    [setVisibleStates, visibleStates],
  );
  const selectAllStates = useCallback(
    () => setVisibleStates(new Set(TASK_STATES.map((state) => state.key))),
    [setVisibleStates],
  );
  const selectActiveStates = useCallback(
    () =>
      setVisibleStates(
        new Set(TASK_STATES.filter((state) => !state.done).map((state) => state.key)),
      ),
    [setVisibleStates],
  );

  const handleToggleTask = useCallback(
    async (todo: TodoItem, newState: string) => {
      const taskIndex = Number.parseInt(todo.id.split('-').at(-1) ?? '', 10);
      if (Number.isNaN(taskIndex)) {
        logger.error('[useTasks] Invalid task index', { todoId: todo.id });
        return;
      }

      const previousState = todo.state;
      const previousChecked = todo.checked;
      setTogglingTodoId(todo.id);
      setTodos((items) =>
        items.map((item) =>
          item.id === todo.id
            ? { ...item, state: newState as TodoItem['state'], checked: newState === 'done' }
            : item,
        ),
      );

      try {
        const success = await updateTaskState(todo.noteId, taskIndex, newState);
        if (!success) throw new Error('Failed to update task state');
      } catch (error) {
        setTodos((items) =>
          items.map((item) =>
            item.id === todo.id
              ? { ...item, state: previousState, checked: previousChecked }
              : item,
          ),
        );
        logger.error('[useTasks] Failed to toggle task', { error });
      } finally {
        setTogglingTodoId(null);
      }
    },
    [setTodos, updateTaskState],
  );

  const folders = useMemo(() => {
    const values = new Set<string>();
    for (const todo of todos) {
      const parts = todo.notePath?.replace(/\\/g, '/').split('/') ?? [];
      if (parts.length > 1) values.add(parts[0]);
    }
    return Array.from(values).sort();
  }, [todos]);

  const filteredTodos = useMemo(
    () =>
      todos.filter((todo) => {
        const matchesSearch =
          !searchQuery || todo.text.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFolder = folderFilter === 'all' || todo.notePath?.startsWith(folderFilter);
        return matchesSearch && matchesFolder && visibleStates.has(todo.state);
      }),
    [folderFilter, searchQuery, todos, visibleStates],
  );

  const groupedTodos = useMemo(() => {
    const groups: Record<string, TodoItem[]> = {};
    if (groupBy === 'state') {
      for (const state of TASK_STATES) if (visibleStates.has(state.key)) groups[state.key] = [];
      for (const todo of filteredTodos) groups[todo.state]?.push(todo);
    } else if (groupBy === 'notebook') {
      for (const todo of filteredTodos) {
        const key = todo.notePath?.replace(/\\/g, '/').split('/')[0] || 'Uncategorized';
        (groups[key] ??= []).push(todo);
      }
    } else if (groupBy === 'note') {
      for (const todo of filteredTodos) (groups[todo.noteTitle || 'Untitled'] ??= []).push(todo);
    } else {
      groups.all = filteredTodos;
    }
    return groups;
  }, [filteredTodos, groupBy, visibleStates]);

  const counts = useMemo<TaskCounts>(() => {
    const scoped = todos.filter((todo) => {
      const matchesSearch =
        !searchQuery || todo.text.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch && (folderFilter === 'all' || todo.notePath?.startsWith(folderFilter));
    });
    const completed = scoped.filter(
      (todo) => todo.state === 'done' || todo.state === 'canceled',
    ).length;
    return {
      active: scoped.length - completed,
      completed,
      total: scoped.length,
      visible: filteredTodos.length,
    };
  }, [filteredTodos.length, folderFilter, searchQuery, todos]);

  return {
    todos,
    loading,
    filteredTodos,
    groupedTodos,
    counts,
    folders,
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
    togglingTodoId,
    handleToggleTask,
  };
}
