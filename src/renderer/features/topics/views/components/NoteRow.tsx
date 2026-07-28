import { memo } from 'react';
import { FileText } from '@phosphor-icons/react';
import { cn } from '@renderer/lib/utils';

export interface TopicNote {
  id: string;
  title: string;
  confidence?: number;
  isManual?: boolean;
}

export const NoteRow = memo(function NoteRow({
  note,
  id,
  isActive = false,
  onClick,
  onMouseEnter,
}: {
  note: TopicNote;
  /** Referenced by the search field's aria-activedescendant while navigating. */
  id?: string;
  isActive?: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
}) {
  return (
    <button
      type="button"
      id={id}
      role="option"
      aria-selected={isActive}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      // Row selection is driven from the search field, so this must not take
      // focus away from it — the reader keeps typing while arrowing the list.
      tabIndex={-1}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-left',
        'border-b border-border/40 last:border-0',
        // Rows highlight, they do not shrink. Scaling a full-width row on press
        // drags its neighbours' edges with it and reads as a glitch.
        'transition-colors duration-150 ease-out',
        // No :hover rule — the pointer sets the active row via onMouseEnter
        // instead. A CSS hover would light a second row wherever the cursor
        // happened to be resting while the keyboard drove the selection.
        isActive && 'bg-muted/60',
      )}
    >
      <FileText className="size-4 text-muted-foreground/60 shrink-0" />
      <span className="flex-1 text-sm truncate">{note.title || 'Untitled'}</span>
      {note.confidence !== undefined && (
        <span
          className="text-[11px] text-muted-foreground tabular-nums"
          title="How closely this note matches, by meaning"
        >
          {Math.round(note.confidence * 100)}%
        </span>
      )}
    </button>
  );
});
