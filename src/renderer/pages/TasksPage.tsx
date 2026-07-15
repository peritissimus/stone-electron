/**
 * TasksPage - Full page view for all tasks grouped by state
 */

import { useCallback } from 'react';
import { CheckSquare, Funnel } from '@phosphor-icons/react';
import { TodoItem } from '@shared/types';
import { useTasks, TASK_STATES } from '@renderer/hooks/useTasks';
import { useNavigateToNote } from '@renderer/navigation';
import { logger } from '@renderer/lib/logger';
import { Skeleton } from '@renderer/components/base/ui/skeleton';
import { Button } from '@renderer/components/base/ui/button';
import { TaskSection } from '@renderer/components/features/Tasks/TaskSection';
import { TasksHeader } from '@renderer/components/features/Tasks/TasksHeader';
import { TasksFilterBar } from '@renderer/components/features/Tasks/TasksFilterBar';

export default function TasksPage() {
  const navigateToNote = useNavigateToNote();
  const {
    loading,
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
  } = useTasks();


  const handleTodoClick = useCallback(
    (todo: TodoItem) => {
      logger.info('[TasksPage] Todo clicked', { noteId: todo.noteId, todoId: todo.id });
      navigateToNote(todo.noteId);
    },
    [navigateToNote],
  );

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <TasksHeader counts={counts} />
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
      <TasksHeader counts={counts} />

      <TasksFilterBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        folders={folders}
        folderFilter={folderFilter}
        setFolderFilter={setFolderFilter}
        visibleStates={visibleStates}
        toggleStateVisibility={toggleStateVisibility}
        selectAllStates={selectAllStates}
        selectActiveStates={selectActiveStates}
        taskStates={TASK_STATES}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
      />

      <div className="flex-1 overflow-auto px-6 pb-8 pt-2">
        <div className="max-w-3xl mx-auto">
          <TasksContent
            counts={counts}
            groupBy={groupBy}
            groupedTodos={groupedTodos}
            visibleStates={visibleStates}
            togglingTodoId={togglingTodoId}
            onTodoClick={handleTodoClick}
            onToggle={handleToggleTask}
            onSelectAllStates={selectAllStates}
          />
        </div>
      </div>
    </div>
  );
}

interface TasksContentProps {
  counts: { total: number; visible: number };
  groupBy: string;
  groupedTodos: Record<string, TodoItem[]>;
  visibleStates: Set<string>;
  togglingTodoId: string | null;
  onTodoClick: (todo: TodoItem) => void;
  onToggle: (todo: TodoItem, newState: string) => Promise<void>;
  onSelectAllStates: () => void;
}

function TasksContent({
  counts,
  groupBy,
  groupedTodos,
  visibleStates,
  togglingTodoId,
  onTodoClick,
  onToggle,
  onSelectAllStates,
}: TasksContentProps) {
  if (counts.total === 0) {
    return (
      <div className="mt-3 rounded-xl bg-muted/20 px-6 py-10 text-center">
        <CheckSquare className="mx-auto mb-3 size-7 text-muted-foreground/50" />
        <h2 className="mb-1 text-sm font-medium text-foreground">No tasks yet</h2>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Add TODO or DOING to a note and it will appear here.
        </p>
      </div>
    );
  }

  if (counts.visible === 0) {
    return (
      <div className="mt-3 rounded-xl bg-muted/20 px-6 py-10 text-center">
        <Funnel size={28} className="mx-auto mb-3 text-muted-foreground/50" />
        <h2 className="mb-1 text-sm font-medium text-foreground">No matching tasks</h2>
        <p className="text-sm text-muted-foreground">
          Nothing matches the current search and filters.
        </p>
        <Button variant="ghost" size="sm" onClick={onSelectAllStates} className="mt-4">
          Show all states
        </Button>
      </div>
    );
  }

  if (groupBy === 'state') {
    return (
      <>
        {TASK_STATES.map((state) =>
          visibleStates.has(state.key) ? (
            <TaskSection
              key={state.key}
              state={state.key}
              label={state.label}
              todos={groupedTodos[state.key] || []}
              onTodoClick={onTodoClick}
              onToggle={onToggle}
              togglingTodoId={togglingTodoId}
              defaultExpanded={!state.done}
            />
          ) : null,
        )}
      </>
    );
  }

  if (groupBy === 'none') {
    return (
      <TaskSection
        state="all"
        label="All Tasks"
        todos={groupedTodos['all'] || []}
        onTodoClick={onTodoClick}
        onToggle={onToggle}
        togglingTodoId={togglingTodoId}
      />
    );
  }

  return (
    <>
      {Object.keys(groupedTodos)
        .sort()
        .map((groupKey) => (
          <TaskSection
            key={groupKey}
            state={groupBy === 'notebook' ? 'folder' : 'note'}
            label={groupKey}
            todos={groupedTodos[groupKey]}
            onTodoClick={onTodoClick}
            onToggle={onToggle}
            togglingTodoId={togglingTodoId}
          />
        ))}
    </>
  );
}
