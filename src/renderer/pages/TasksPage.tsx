/**
 * TasksPage - Full page view for all tasks grouped by state
 */

import { useCallback } from 'react';
import { CheckSquare, Funnel } from '@phosphor-icons/react';
import { TodoItem } from '@shared/types';
import { useSidebarUI } from '@renderer/hooks/useUI';
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

  const { toggleSidebar, sidebarOpen } = useSidebarUI();

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
        <TasksHeader sidebarOpen={sidebarOpen} toggleSidebar={toggleSidebar} counts={counts} />
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
      <TasksHeader sidebarOpen={sidebarOpen} toggleSidebar={toggleSidebar} counts={counts} />

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

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
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
      <div className="text-center py-16">
        <CheckSquare className="size-12 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-muted-foreground mb-2">No tasks yet</h2>
        <p className="text-sm text-muted-foreground/70">
          Create tasks in your notes using TODO, DOING, or other task states
        </p>
      </div>
    );
  }

  if (counts.visible === 0) {
    return (
      <div className="text-center py-16">
        <Funnel size={48} className="text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-muted-foreground mb-2">No matching tasks</h2>
        <p className="text-sm text-muted-foreground/70">
          Try adjusting your filters or search query
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
        {TASK_STATES.filter((s) => visibleStates.has(s.key)).map((state) => (
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
        ))}
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
