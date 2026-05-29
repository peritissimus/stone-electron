import { memo } from 'react';
import { FileText } from 'phosphor-react';
import { cn } from '@renderer/lib/utils';

export interface TopicNote {
  id: string;
  title: string;
  confidence?: number;
  isManual?: boolean;
}

export const NoteRow = memo(function NoteRow({
  note,
  onClick,
}: {
  note: TopicNote;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-left',
        'border-b border-border/40 last:border-0',
        'hover:bg-muted/50 transition-[background-color,transform] duration-150 ease-out active:scale-[0.96]',
      )}
    >
      <FileText className="size-4 text-muted-foreground/60 shrink-0" />
      <span className="flex-1 text-sm truncate">{note.title || 'Untitled'}</span>
      {note.confidence && (
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {Math.round(note.confidence * 100)}%
        </span>
      )}
    </button>
  );
});
