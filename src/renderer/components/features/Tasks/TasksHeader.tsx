import { CheckSquare, CaretRight } from 'phosphor-react';
import { IconButton, sizeHeightClasses } from '@renderer/components/composites';
import { cn } from '@renderer/lib/utils';

interface TasksHeaderProps {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  counts: { visible: number; total: number };
}

export function TasksHeader({ sidebarOpen, toggleSidebar, counts }: TasksHeaderProps) {
  return (
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
  );
}
