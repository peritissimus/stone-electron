/**
 * TaskItem - Individual task row component
 *
 * Implements: specs/components.ts#TodoItemProps
 */

import { memo } from 'react';
import { ArrowRight, Circle } from 'phosphor-react';
import { TodoItem } from '@shared/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/base/ui/dropdown-menu';

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

export const TaskItem = memo(function TaskItem({ todo, onClick, onToggle, isToggling }: TaskItemProps) {
  const isDone = todo.state === 'done' || todo.state === 'canceled';
  const badgeColor = STATE_BADGE_COLORS[todo.state] || STATE_BADGE_COLORS.todo;

  const handleStateChange = (newState: string) => {
    if (onToggle && !isToggling && newState !== todo.state) {
      onToggle(newState);
    }
  };

  return (
    <div
      onClick={onClick}
      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/10 cursor-pointer transition-colors group text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeColor} hover:opacity-80 transition-opacity`}
              >
                {todo.state.toUpperCase()}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
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
          <p className={`text-sm ${isDone ? 'text-muted-foreground line-through' : ''}`}>
            {todo.text}
          </p>
        </div>
        {todo.noteTitle && (
          <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{todo.noteTitle}</p>
        )}
      </div>
      <ArrowRight size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
    </div>
  );
});
