import { memo } from 'react';
import { CaretRight } from '@phosphor-icons/react';
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
        'group w-full flex items-center gap-3 rounded-lg px-4 py-4 text-left',
        'bg-muted/25 hover:bg-muted/50 transition-[background-color,transform] active:scale-[0.99]',
        isSelected && 'bg-muted/70 ring-1 ring-border',
      )}
    >
      <div className="size-2 rounded-full shrink-0 bg-muted-foreground/50" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{topic.name}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
          {topic.noteCount || 0} {topic.noteCount === 1 ? 'note' : 'notes'}
        </span>
      </span>
      <CaretRight
        size={16}
        className="text-muted-foreground/40 transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
});
