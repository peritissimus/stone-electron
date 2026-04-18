/**
 * TaskSection - Collapsible section for tasks grouped by state
 */

import { useState, memo } from 'react';
import { CaretRight } from 'phosphor-react';
import { TodoItem } from '@shared/types';
import { TaskItem } from './TaskItem';

interface TaskSectionProps {
  state: string;
  label: string;
  todos: TodoItem[];
  onTodoClick: (todo: TodoItem) => void;
  onToggle?: (todo: TodoItem, newState: string) => Promise<void>;
  togglingTodoId?: string | null;
  defaultExpanded?: boolean;
}

const STATE_COLORS: Record<string, string> = {
  doing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  waiting: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  todo: 'bg-foreground/5 text-foreground',
  hold: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  idea: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  done: 'bg-green-500/10 text-green-600 dark:text-green-400',
  canceled: 'bg-muted text-muted-foreground',
  // Group types
  folder: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  note: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  all: 'bg-foreground/5 text-foreground',
};

export const TaskSection = memo(function TaskSection({
  state,
  label,
  todos,
  onTodoClick,
  onToggle,
  togglingTodoId,
  defaultExpanded = true,
}: TaskSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (todos.length === 0) return null;

  const colorClass = STATE_COLORS[state] || STATE_COLORS.todo;

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/10 transition-colors"
      >
        <CaretRight
          size={16}
          className={`text-muted-foreground motion-safe:transition-transform duration-200 ease-out ${expanded ? 'rotate-90' : ''}`}
        />
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${colorClass}`}>{label}</span>
        <span className="text-xs text-muted-foreground">{todos.length}</span>
      </button>

      <div
        className={`grid motion-safe:transition-[grid-template-rows] duration-200 ease-out ${
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="mt-1 ml-2">
            {todos.map((todo) => (
              <TaskItem
                key={todo.id}
                todo={todo}
                onClick={() => onTodoClick(todo)}
                onToggle={onToggle ? (newState) => onToggle(todo, newState) : undefined}
                isToggling={togglingTodoId === todo.id}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
