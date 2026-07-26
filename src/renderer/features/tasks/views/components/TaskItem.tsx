/**
 * TaskItem - Individual task row component
 *
 * Implements: specs/components.ts#TodoItemProps
 */

import { memo } from 'react';
import { Circle } from '@phosphor-icons/react';
import { TodoItem } from '@shared/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/base/ui/dropdown-menu';
import { cn } from '@renderer/lib/utils';

// All available task states
const TASK_STATES = [
  { key: 'todo', label: 'TODO' },
  { key: 'doing', label: 'DOING' },
  { key: 'waiting', label: 'WAITING' },
  { key: 'hold', label: 'HOLD' },
  { key: 'idea', label: 'IDEA' },
  { key: 'done', label: 'DONE' },
  { key: 'canceled', label: 'CANCELED' },
];

const STATE_BADGE_COLORS: Record<string, string> = {
  doing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  waiting: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  todo: 'bg-foreground/5 text-foreground',
  hold: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  idea: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  done: 'bg-green-500/10 text-green-600 dark:text-green-400',
  canceled: 'bg-muted text-muted-foreground',
};

interface TaskItemProps {
  todo: TodoItem;
  onClick: () => void;
  onToggle?: (newState: string) => Promise<void>;
  isToggling?: boolean;
}

export const TaskItem = memo(function TaskItem({
  todo,
  onClick,
  onToggle,
  isToggling,
}: TaskItemProps) {
  const isDone = todo.state === 'done' || todo.state === 'canceled';
  const badgeColor = STATE_BADGE_COLORS[todo.state] || STATE_BADGE_COLORS.todo;

  const handleStateChange = (newState: string) => {
    if (onToggle && !isToggling && newState !== todo.state) {
      onToggle(newState);
    }
  };

  return (
    // The row is a plain container rather than a role="button": it holds the
    // state menu, and nesting a button inside a button is invalid and leaves
    // the menu unreachable by keyboard. Full-row clickability comes from the
    // title button stretching over the row instead (see `after:absolute`
    // below), so the tag stays above it and keeps its own hit area.
    <div
      className={cn(
        'group relative flex items-start rounded-lg px-2 py-2',
        'transition-colors duration-150 ease-out hover:bg-foreground/[0.035]',
        'focus-within:bg-foreground/[0.035]',
        isToggling && 'opacity-60',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Change state, currently ${todo.state.toUpperCase()}`}
                className={cn(
                  'relative z-10 rounded px-1.5 py-0.5 text-[10px] font-semibold',
                  'transition-opacity duration-150 ease-out hover:opacity-80',
                  'focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring/25',
                  badgeColor,
                )}
              >
                {todo.state.toUpperCase()}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {TASK_STATES.map((state) => (
                <DropdownMenuItem
                  key={state.key}
                  onClick={() => handleStateChange(state.key)}
                  className="gap-2"
                >
                  <Circle size={8} weight={state.key === todo.state ? 'fill' : 'regular'} />
                  <span className={state.key === todo.state ? 'font-medium' : ''}>
                    {state.label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={onClick}
            className={cn(
              'min-w-0 text-left text-sm after:absolute after:inset-0 after:rounded-lg',
              'focus-visible:outline-hidden focus-visible:after:ring-1 focus-visible:after:ring-ring/25',
              isDone && 'text-muted-foreground line-through decoration-muted-foreground/40',
            )}
          >
            {todo.text}
          </button>
        </div>
        {todo.noteTitle && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{todo.noteTitle}</p>
        )}
      </div>
    </div>
  );
});
