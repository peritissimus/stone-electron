import { useState } from 'react';
import { ArrowSquareOut, Circle, PlusCircle } from 'phosphor-react';
import type { JournalEntry } from '@shared/schemas';
import { cn } from '@renderer/lib/utils';
import { JournalDayEditor } from './JournalDayEditor';

function parseDateOnly(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDayName(date: string): string {
  return parseDateOnly(date).toLocaleDateString('en-US', { weekday: 'long' });
}

function formatMonth(date: string): string {
  return parseDateOnly(date).toLocaleDateString('en-US', { month: 'short' });
}

function formatDayOfMonth(date: string): string {
  return String(parseDateOnly(date).getDate()).padStart(2, '0');
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

  const handlePrimaryAction = () => {
    if (entry.noteId) {
      onOpen(entry.date, entry.noteId);
      return;
    }
    void handleStart();
  };

  return (
    <article className="group grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 border-b border-border/30 py-7 last:border-b-0 sm:grid-cols-[5.25rem_minmax(0,1fr)] sm:gap-6">
      <aside className="pt-1 text-right">
        <button
          type="button"
          onClick={handlePrimaryAction}
          disabled={!entry.exists && materializing}
          className={cn(
            'inline-flex min-w-0 flex-col items-end rounded-md px-1 py-0.5 transition-colors',
            'hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-progress disabled:opacity-60',
            today ? 'text-primary' : 'text-muted-foreground',
          )}
          aria-label={entry.exists ? `Open ${entry.date}` : `Start ${entry.date}`}
        >
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em]">
            {formatMonth(entry.date)}
          </span>
          <span className="font-mono text-2xl font-semibold leading-none">
            {formatDayOfMonth(entry.date)}
          </span>
          <span className="mt-1 max-w-full truncate text-[0.68rem] font-medium uppercase tracking-[0.08em]">
            {today ? 'Today' : formatDayName(entry.date)}
          </span>
        </button>
      </aside>

      <section className="min-w-0">
        <header className="mb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={!entry.exists && materializing}
            className={cn(
              'min-w-0 flex-1 truncate text-left text-base font-semibold leading-tight',
              'transition-colors hover:text-primary disabled:cursor-progress disabled:opacity-60',
              today ? 'text-primary' : 'text-foreground',
            )}
          >
            {formatDisplayDate(entry.date)}
          </button>
          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={!entry.exists && materializing}
            className={cn(
              'ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground',
              'opacity-0 transition-[background-color,color,opacity,transform] hover:bg-muted hover:text-foreground active:scale-[0.96] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              !entry.exists && 'opacity-100',
              'disabled:cursor-progress disabled:opacity-60',
            )}
            aria-label={entry.exists ? `Open ${entry.date}` : `Start ${entry.date}`}
            title={entry.exists ? 'Open' : 'Start'}
          >
            {entry.exists ? <ArrowSquareOut size={15} /> : <PlusCircle size={15} />}
          </button>
        </header>

        <div className="journal-entry-surface">
          {entry.noteId ? (
            <JournalDayEditor noteId={entry.noteId} />
          ) : (
            <button
              type="button"
              onClick={handleStart}
              disabled={materializing}
              className={cn(
                'group/empty flex min-h-10 w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm text-muted-foreground',
                'transition-colors hover:bg-muted/35 hover:text-foreground',
                'disabled:cursor-progress disabled:opacity-60',
              )}
            >
              <Circle
                size={8}
                weight="fill"
                className="mx-[5.5px] shrink-0 text-muted-foreground/50"
              />
              <span>{materializing ? 'Starting...' : 'Start writing'}</span>
            </button>
          )}
        </div>
      </section>
    </article>
  );
}
