import { CheckSquare } from '@phosphor-icons/react';
import { sizeHeightClasses } from '@renderer/components/composites';
import { cn } from '@renderer/lib/utils';

interface TasksHeaderProps {
  counts: { visible: number; total: number };
}

export function TasksHeader({ counts }: TasksHeaderProps) {
  return (
    <div
      className={cn(
        'px-4 border-b border-border shrink-0 bg-card flex items-center gap-3',
        sizeHeightClasses['spacious'],
      )}
    >
      <CheckSquare className="size-4 text-muted-foreground" />
      <span className="text-sm font-medium">Tasks</span>
      <div className="flex-1" />
      <span className="text-xs text-muted-foreground">
        {counts.visible} of {counts.total} tasks
      </span>
    </div>
  );
}
