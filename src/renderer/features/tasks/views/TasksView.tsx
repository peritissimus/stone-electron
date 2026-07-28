/**
 * TasksPage - Full page view for all tasks grouped by state
 */

import { useCallback, type ReactNode } from 'react';
import { CheckCircle, CheckSquare, Funnel } from '@phosphor-icons/react';
import { TodoItem } from '@shared/types';
import { useTasks, TASK_STATES } from '@renderer/features/tasks/hooks/useTasks';
import { useNavigateToNote } from '@renderer/services/navigation';
import { logger } from '@renderer/services/telemetry/logger';
import { Skeleton } from '@renderer/components/base/ui/skeleton';
import { Button } from '@renderer/components/base/ui/button';
import { TaskSection } from '@renderer/features/tasks/views/components/TaskSection';
import { TasksHeader } from '@renderer/features/tasks/views/components/TasksHeader';
import { TasksFilterBar } from '@renderer/features/tasks/views/components/TasksFilterBar';
import { useViewScrollRestoration } from '@renderer/services/view-state/hooks/useViewScrollRestoration';

export default function TasksView() {
  const scrollRef = useViewScrollRestoration('tasks');
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

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setFolderFilter('all');
    selectActiveStates();
  }, [selectActiveStates, setFolderFilter, setSearchQuery]);

  const isNarrowed = searchQuery.trim() !== '' || folderFilter !== 'all';

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

      <div ref={scrollRef} className="flex-1 overflow-auto px-6 pb-8 pt-2">
        <div className="max-w-3xl mx-auto">
          <TasksContent
            counts={counts}
            groupBy={groupBy}
            groupedTodos={groupedTodos}
            visibleStates={visibleStates}
            togglingTodoId={togglingTodoId}
            isNarrowed={isNarrowed}
            onTodoClick={handleTodoClick}
            onToggle={handleToggleTask}
            onSelectAllStates={selectAllStates}
            onClearFilters={handleClearFilters}
          />
        </div>
      </div>
    </div>
  );
}

interface TasksContentProps {
  counts: { total: number; visible: number; active: number; completed: number };
  groupBy: string;
  groupedTodos: Record<string, TodoItem[]>;
  visibleStates: Set<string>;
  togglingTodoId: string | null;
  /** A search term or notebook filter is narrowing the set, not just state visibility. */
  isNarrowed: boolean;
  onTodoClick: (todo: TodoItem) => void;
  onToggle: (todo: TodoItem, newState: string) => Promise<void>;
  onSelectAllStates: () => void;
  onClearFilters: () => void;
}

function TasksContent({
  counts,
  groupBy,
  groupedTodos,
  visibleStates,
  togglingTodoId,
  isNarrowed,
  onTodoClick,
  onToggle,
  onSelectAllStates,
  onClearFilters,
}: TasksContentProps) {
  if (counts.total === 0) {
    return (
      <EmptyState
        icon={<CheckSquare size={28} className="text-muted-foreground/50" />}
        title="No tasks yet"
        body="Add TODO or DOING to a note and it will appear here."
      />
    );
  }

  // Every task being finished is the good outcome, not a failed query. Reporting
  // it as "nothing matches your filters" when the reader has typed nothing and
  // touched nothing makes a working page look broken.
  if (counts.visible === 0 && !isNarrowed && counts.active === 0) {
    return (
      <EmptyState
        icon={<CheckCircle size={28} className="text-muted-foreground/50" />}
        title="You're all caught up"
        body={`Nothing active. ${counts.completed} ${counts.completed === 1 ? 'task is' : 'tasks are'} finished.`}
        action={
          <Button variant="outline" size="sm" onClick={onSelectAllStates}>
            Show completed
          </Button>
        }
      />
    );
  }

  if (counts.visible === 0) {
    return (
      <EmptyState
        icon={<Funnel size={28} className="text-muted-foreground/50" />}
        title="No matching tasks"
        body={`${counts.total} ${counts.total === 1 ? 'task is' : 'tasks are'} hidden by the current search and filters.`}
        action={
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Clear filters
          </Button>
        }
      />
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

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}

function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="mt-3 rounded-xl bg-muted/20 px-6 py-12 text-center">
      <div className="mb-3 flex justify-center">{icon}</div>
      <h2 className="mb-1 text-sm font-medium text-foreground">{title}</h2>
      <p className="mx-auto max-w-sm text-pretty text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
