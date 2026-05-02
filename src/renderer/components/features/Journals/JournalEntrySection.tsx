import { useState } from 'react';
import { ArrowSquareOut, PlusCircle } from 'phosphor-react';
import type { JournalEntry } from '@shared/schemas';
import { cn } from '@renderer/lib/utils';
import { JournalDayEditor } from './JournalDayEditor';

function parseDateOnly(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDayName(date: string): string {
  return parseDateOnly(date).toLocaleDateString('en-US', { weekday: 'short' });
}

function formatDisplayDate(date: string): string {
  return parseDateOnly(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function isToday(date: string): boolean {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  return date === today;
}

export function JournalEntrySection({
  entry,
  onOpen,
  onMaterialize,
}: {
  entry: JournalEntry;
  onOpen: (date: string, noteId: string | null) => void;
  onMaterialize: (date: string) => Promise<void>;
}) {
  const today = isToday(entry.date);
  const [materializing, setMaterializing] = useState(false);

  const handleStart = async () => {
    if (entry.exists || materializing) return;
    setMaterializing(true);
    try {
      await onMaterialize(entry.date);
    } finally {
      setMaterializing(false);
    }
  };

  return (
    <article className="group border-b border-border/30 py-8 last:border-b-0">
      <header className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onOpen(entry.date, entry.noteId)}
          className={cn(
            'min-w-0 flex-1 text-left text-lg font-semibold leading-tight',
            'transition-colors hover:text-primary',
            today ? 'text-primary' : 'text-foreground',
          )}
        >
          {formatDisplayDate(entry.date)}
        </button>
        <span className="shrink-0 text-xs font-medium uppercase text-muted-foreground">
          {formatDayName(entry.date)}
        </span>
        <button
          type="button"
          onClick={() => onOpen(entry.date, entry.noteId)}
          className={cn(
            'ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground',
            'opacity-0 transition-[background-color,color,opacity,transform] hover:bg-muted hover:text-foreground active:scale-[0.96] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
          aria-label={entry.exists ? `Open ${entry.date}` : `Start ${entry.date}`}
          title={entry.exists ? 'Open' : 'Start'}
        >
          {entry.exists ? <ArrowSquareOut size={15} /> : <PlusCircle size={15} />}
        </button>
      </header>

      {entry.noteId ? (
        <JournalDayEditor noteId={entry.noteId} />
      ) : (
        <button
          type="button"
          onClick={handleStart}
          disabled={materializing}
          className={cn(
            'group/empty w-full rounded-md border border-dashed border-border/50 px-4 py-6 text-left text-sm text-muted-foreground',
            'transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground',
            'disabled:cursor-progress disabled:opacity-60',
          )}
        >
          {materializing ? 'Starting…' : 'No entry yet — click to start writing.'}
        </button>
      )}
    </article>
  );
}
