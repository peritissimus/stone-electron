/**
 * TasksPage - Full page view for all tasks grouped by state
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CheckSquare, Search, FolderOpen, Layers, Filter } from 'lucide-react';
import { CaretRight } from 'phosphor-react';
import { TodoItem } from '@shared/types';
import { useFileEvents } from '@renderer/hooks/useFileEvents';
import { useNoteEvents } from '@renderer/hooks/useNoteEvents';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useSidebarUI } from '@renderer/hooks/useUI';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { logger } from '@renderer/utils/logger';
import { Skeleton } from '@renderer/components/base/ui/skeleton';
import { Input } from '@renderer/components/base/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/base/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@renderer/components/base/ui/dropdown-menu';
import { Button } from '@renderer/components/base/ui/button';
import { IconButton, sizeHeightClasses } from '@renderer/components/composites';
import { cn } from '@renderer/lib/utils';
import { TaskSection } from './TaskSection';

// State configuration in priority order
const TASK_STATES = [
  { key: 'doing', label: 'DOING', done: false, color: 'bg-blue-500' },
  { key: 'waiting', label: 'WAITING', done: false, color: 'bg-yellow-500' },
  { key: 'todo', label: 'TODO', done: false, color: 'bg-gray-400' },
  { key: 'hold', label: 'HOLD', done: false, color: 'bg-orange-500' },
  { key: 'idea', label: 'IDEA', done: false, color: 'bg-purple-500' },
  { key: 'done', label: 'DONE', done: true, color: 'bg-green-500' },
  { key: 'canceled', label: 'CANCELED', done: true, color: 'bg-gray-300' },
];

type GroupByOption = 'state' | 'notebook' | 'note' | 'none';

export function TasksPage() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [togglingTodoId, setTogglingTodoId] = useState<string | null>(null);
  const [visibleStates, setVisibleStates] = useState<Set<string>>(
    () => new Set(TASK_STATES.filter((s) => !s.done).map((s) => s.key)),
  );
  const [groupBy, setGroupBy] = useState<GroupByOption>('state');
  const { setActiveNote } = useNoteStore();
  const { setSelectedFile, setActiveFolder } = useFileTreeStore();
  const { toggleSidebar, sidebarOpen } = useSidebarUI();
  const { getAllTodos, updateTaskState } = useNoteAPI();

  // Debounce timer ref for auto-refresh
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
        logger.error('[TasksPage] Failed to load todos', { error });
      } finally {
        if (showLoadingState) setLoading(false);
      }
    },
    [getAllTodos],
  );

  // Initial load
  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  // Debounced refresh handler
  const debouncedRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      loadTodos(false); // Silent refresh without loading state
    }, 500);
  }, [loadTodos]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  // Auto-refresh on note updates
  useNoteEvents({
    onUpdated: debouncedRefresh,
  });

  // Auto-refresh on file changes
  useFileEvents({
    onChanged: debouncedRefresh,
  });

  // Extract unique folders for filter dropdown
  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const todo of todos) {
      if (todo.notePath) {
        const parts = todo.notePath.replace(/\\/g, '/').split('/');
        if (parts.length > 1) {
          set.add(parts[0]); // Top-level folder
        }
      }
    }
    return Array.from(set).sort();
  }, [todos]);

  // Filter todos based on search, folder, and visible states
  const filteredTodos = useMemo(() => {
    return todos.filter((todo) => {
      const matchesSearch =
        !searchQuery || todo.text.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFolder = folderFilter === 'all' || todo.notePath?.startsWith(folderFilter);
      const matchesState = visibleStates.has(todo.state);
      return matchesSearch && matchesFolder && matchesState;
    });
  }, [todos, searchQuery, folderFilter, visibleStates]);

  // Group filtered todos based on groupBy option
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
        if (!groups[notebook]) {
          groups[notebook] = [];
        }
        groups[notebook].push(todo);
      }
    } else if (groupBy === 'note') {
      for (const todo of filteredTodos) {
        const noteKey = todo.noteTitle || 'Untitled';
        if (!groups[noteKey]) {
          groups[noteKey] = [];
        }
        groups[noteKey].push(todo);
      }
    } else {
      // 'none' - flat list
      groups['all'] = filteredTodos;
    }

    return groups;
  }, [filteredTodos, groupBy, visibleStates]);

  // Count active vs completed (from all todos matching search/folder)
  const counts = useMemo(() => {
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

  // Toggle state visibility
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

  // Select all / none states
  const selectAllStates = useCallback(() => {
    setVisibleStates(new Set(TASK_STATES.map((s) => s.key)));
  }, []);

  const selectActiveStates = useCallback(() => {
    setVisibleStates(new Set(TASK_STATES.filter((s) => !s.done).map((s) => s.key)));
  }, []);

  const handleTodoClick = useCallback(
    (todo: TodoItem) => {
      logger.info('[TasksPage] Todo clicked', { noteId: todo.noteId, todoId: todo.id });

      // Set the selected file and active folder
      if (todo.notePath) {
        const normalizedPath = todo.notePath
          .replace(/\\/g, '/')
          .replace(/^\/+/, '')
          .replace(/\/+$/, '');
        setSelectedFile(normalizedPath);

        const lastSlash = normalizedPath.lastIndexOf('/');
        if (lastSlash > 0) {
          const folderPath = normalizedPath.substring(0, lastSlash);
          setActiveFolder(folderPath);
        }
      }

      // Set the active note
      setActiveNote(todo.noteId);
    },
    [setActiveNote, setSelectedFile, setActiveFolder],
  );

  // Handle toggling task state
  const handleToggleTask = useCallback(
    async (todo: TodoItem, newState: string) => {
      // Extract task index from todo.id (format: "noteId-index")
      const parts = todo.id.split('-');
      const taskIndex = parseInt(parts[parts.length - 1], 10);

      if (isNaN(taskIndex)) {
        logger.error('[TasksPage] Invalid task index', { todoId: todo.id });
        return;
      }

      setTogglingTodoId(todo.id);

      try {
        // Optimistic update
        setTodos((prev) =>
          prev.map((t) =>
            t.id === todo.id
              ? { ...t, state: newState as TodoItem['state'], checked: newState === 'done' }
              : t,
          ),
        );

        const success = await updateTaskState(todo.noteId, taskIndex, newState);

        if (!success) {
          // Revert on error
          setTodos((prev) =>
            prev.map((t) =>
              t.id === todo.id ? { ...t, state: todo.state, checked: todo.checked } : t,
            ),
          );
          logger.error('[TasksPage] Failed to update task state');
        }
      } catch (error) {
        // Revert on error
        setTodos((prev) =>
          prev.map((t) =>
            t.id === todo.id ? { ...t, state: todo.state, checked: todo.checked } : t,
          ),
        );
        logger.error('[TasksPage] Failed to toggle task', { error });
      } finally {
        setTogglingTodoId(null);
      }
    },
    [updateTaskState],
  );

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div
          className={cn(
            'px-4 border-b border-border shrink-0 bg-card flex items-center gap-3',
            sizeHeightClasses['spacious'],
          )}
        >
          {!sidebarOpen && (
            <IconButton
              size="normal"
              icon={<CaretRight size={16} weight="bold" />}
              tooltip="Expand sidebar"
              onClick={toggleSidebar}
            />
          )}
          <CheckSquare className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Tasks</span>
          <div className="flex-1" />
          <Skeleton className="w-20 h-4 rounded" />
        </div>
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-6 w-24 rounded" />
                <Skeleton className="h-12 w-full rounded" />
                <Skeleton className="h-12 w-full rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header Bar */}
      <div
        className={cn(
          'px-4 border-b border-border shrink-0 bg-card flex items-center gap-3',
          sizeHeightClasses['spacious'],
        )}
      >
        {!sidebarOpen && (
          <IconButton
            size="normal"
            icon={<CaretRight size={16} weight="bold" />}
            tooltip="Expand sidebar"
            onClick={toggleSidebar}
          />
        )}
        <CheckSquare className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Tasks</span>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {counts.visible} of {counts.total} tasks
        </span>
      </div>

      {/* Filter Bar */}
      <div className="px-4 py-2 border-b border-border bg-card/50 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8"
          />
        </div>

        {/* Notebook Filter */}
        {folders.length > 0 && (
          <Select value={folderFilter} onValueChange={setFolderFilter}>
            <SelectTrigger className="w-[140px] h-8">
              <FolderOpen className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All notebooks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All notebooks</SelectItem>
              {folders.map((folder) => (
                <SelectItem key={folder} value={folder}>
                  {folder}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* State Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-2">
              <Filter className="w-4 h-4" />
              States
              <span className="text-xs text-muted-foreground">
                ({visibleStates.size}/{TASK_STATES.length})
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Show States</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {TASK_STATES.map((state) => (
              <DropdownMenuCheckboxItem
                key={state.key}
                checked={visibleStates.has(state.key)}
                onCheckedChange={() => toggleStateVisibility(state.key)}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${state.color}`} />
                  {state.label}
                </div>
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={visibleStates.size === TASK_STATES.length}
              onCheckedChange={selectAllStates}
            >
              All states
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={
                visibleStates.size === TASK_STATES.filter((s) => !s.done).length &&
                TASK_STATES.filter((s) => !s.done).every((s) => visibleStates.has(s.key))
              }
              onCheckedChange={selectActiveStates}
            >
              Active only
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Group By */}
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByOption)}>
          <SelectTrigger className="w-[140px] h-8">
            <Layers className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="state">By State</SelectItem>
            <SelectItem value="notebook">By Notebook</SelectItem>
            <SelectItem value="note">By Note</SelectItem>
            <SelectItem value="none">No Grouping</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          {counts.total === 0 ? (
            <div className="text-center py-16">
              <CheckSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-lg font-medium text-muted-foreground mb-2">No tasks yet</h2>
              <p className="text-sm text-muted-foreground/70">
                Create tasks in your notes using TODO, DOING, or other task states
              </p>
            </div>
          ) : counts.visible === 0 ? (
            <div className="text-center py-16">
              <Filter className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-lg font-medium text-muted-foreground mb-2">No matching tasks</h2>
              <p className="text-sm text-muted-foreground/70">
                Try adjusting your filters or search query
              </p>
              <Button variant="ghost" size="sm" onClick={selectAllStates} className="mt-4">
                Show all states
              </Button>
            </div>
          ) : groupBy === 'state' ? (
            // Group by state - use state order
            <>
              {TASK_STATES.filter((s) => visibleStates.has(s.key)).map((state) => (
                <TaskSection
                  key={state.key}
                  state={state.key}
                  label={state.label}
                  todos={groupedTodos[state.key] || []}
                  onTodoClick={handleTodoClick}
                  onToggle={handleToggleTask}
                  togglingTodoId={togglingTodoId}
                  defaultExpanded={!state.done}
                />
              ))}
            </>
          ) : groupBy === 'none' ? (
            // Flat list
            <TaskSection
              state="all"
              label="All Tasks"
              todos={groupedTodos['all'] || []}
              onTodoClick={handleTodoClick}
              onToggle={handleToggleTask}
              togglingTodoId={togglingTodoId}
            />
          ) : (
            // Group by notebook or note
            <>
              {Object.keys(groupedTodos)
                .sort()
                .map((groupKey) => (
                  <TaskSection
                    key={groupKey}
                    state={groupBy === 'notebook' ? 'folder' : 'note'}
                    label={groupKey}
                    todos={groupedTodos[groupKey]}
                    onTodoClick={handleTodoClick}
                    onToggle={handleToggleTask}
                    togglingTodoId={togglingTodoId}
                  />
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
