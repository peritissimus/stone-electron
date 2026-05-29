import { memo } from 'react';
import { CaretRight } from 'phosphor-react';
import { cn } from '@renderer/lib/utils';
import type { TopicWithCount } from '@shared/types';

export const TopicRow = memo(function TopicRow({
  topic,
  onClick,
  isSelected,
}: {
  topic: TopicWithCount;
  onClick: () => void;
  isSelected: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 text-left',
        'border-b border-border/40 last:border-0',
        'hover:bg-muted/50 transition-colors',
        isSelected && 'bg-muted/70',
      )}
    >
      <div
        className="size-2.5 rounded-full shrink-0"
        style={{ backgroundColor: topic.color || '#6366f1' }}
      />
      <span className="flex-1 text-sm font-medium truncate">{topic.name}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{topic.noteCount || 0}</span>
      <CaretRight size={16} className="text-muted-foreground/50" />
    </button>
  );
});
