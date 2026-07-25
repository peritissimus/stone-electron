/**
 * Knowledge page — one job: find a note by meaning.
 *
 * The page is a single centered semantic search bar with results inline.
 * Topics are maintained by the background organizer in the main process and
 * have no UI here; index health only surfaces when it needs attention.
 *
 * Route is unchanged (`/topics`) so deep links stay valid.
 */

import { useCallback } from 'react';
import { ArrowsClockwise, MagnifyingGlass, WarningCircle, X } from '@phosphor-icons/react';
import { useNavigateToNote } from '@renderer/services/navigation';
import { useTopicsData } from '@renderer/features/topics/hooks/useTopicsData';
import { useIndexStats } from '@renderer/features/topics/hooks/useIndexStats';
import { Input } from '@renderer/components/base/ui/input';
import { Button } from '@renderer/components/base/ui/button';
import { cn } from '@renderer/lib/utils';
import { NoteRow } from '@renderer/features/topics/views/components/NoteRow';
import { useViewScrollRestoration } from '@renderer/services/view-state/hooks/useViewScrollRestoration';

interface IndexStatusCardProps {
  stats: {
    totalNotes: number;
    indexedNotes: number;
    pendingNotes: number;
    failedNotes: number;
    chunkCount: number;
  } | null;
  rebuilding: boolean;
  onReindex: () => void;
}

function IndexStatusCard({ stats, rebuilding, onReindex }: IndexStatusCardProps) {
  const total = stats?.totalNotes ?? 0;
  const indexed = stats?.indexedNotes ?? 0;
  const pending = stats?.pendingNotes ?? 0;
  const failed = stats?.failedNotes ?? 0;
  const isComplete = total > 0 && pending === 0 && failed === 0;

  // Indexing is infrastructure. Keep it out of the user's way unless there is
  // an actual exception they can recover from.
  if (!stats || total === 0 || isComplete) return null;

  const hasFailures = failed > 0;
  const title = hasFailures
    ? `${failed} note${failed === 1 ? '' : 's'} couldn’t be indexed`
    : `${pending} note${pending === 1 ? '' : 's'} waiting to be indexed`;
  const description = hasFailures
    ? `${indexed} of ${total} notes are still searchable. Retry to include the remaining ${failed}.`
    : `${indexed} of ${total} notes are searchable. Finish indexing to include the remaining ${pending}.`;

  return (
    <section
      className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <WarningCircle
            size={16}
            className={cn(
              'mt-0.5 shrink-0',
              hasFailures ? 'text-destructive/80' : 'text-muted-foreground',
            )}
          />
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">{title}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
          </div>
        </div>

        <Button
          size="sm"
          variant="ghost"
          disabled={rebuilding}
          onClick={onReindex}
          title={hasFailures ? 'Retry notes that could not be indexed' : 'Index remaining notes'}
        >
          <ArrowsClockwise size={14} className={cn(rebuilding && 'animate-spin')} />
          {rebuilding ? 'Indexing…' : hasFailures ? 'Retry indexing' : 'Finish indexing'}
        </Button>
      </div>
    </section>
  );
}

export default function TopicsView() {
  const scrollRef = useViewScrollRestoration('topics');
  const navigateToNote = useNavigateToNote();

  const { searchResults, searchQuery, searchInput, searching, error, initializing, setSearchInput } =
    useTopicsData();

  const { stats: indexStats, rebuilding, rebuildAll } = useIndexStats();

  const handleReindex = useCallback(async () => {
    await rebuildAll(false);
  }, [rebuildAll]);

  if (initializing) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto bg-background">
      <div
        className={cn(
          'mx-auto flex min-h-full w-full max-w-2xl flex-col gap-6 px-6 py-10',
          // Idle, the field is the page and sits in the middle. Once there are
          // results it anchors to the top so they read as a list under it.
          searchQuery ? 'justify-start' : 'justify-center',
        )}
      >
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <section className="space-y-3">
          <div className="relative">
            <MagnifyingGlass
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="text"
              autoFocus
              aria-label="Search notes by meaning"
              placeholder="Find notes by meaning, not just keywords…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && searchInput) {
                  e.preventDefault();
                  setSearchInput('');
                }
              }}
              className="h-14 rounded-2xl border-border/70 bg-card pl-11 pr-11 text-[15px] shadow-sm"
            />
            {searching ? (
              <div className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
            ) : (
              searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  aria-label="Clear search"
                  className={cn(
                    'absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md',
                    'text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out',
                    'hover:bg-muted hover:text-foreground active:scale-[0.96]',
                  )}
                >
                  <X size={14} />
                </button>
              )
            )}
          </div>

          {searchQuery && (
            <div className="overflow-hidden rounded-xl border border-border/60">
              {searchResults.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No semantic matches for "{searchQuery}"
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {searchResults.map((r) => (
                    <NoteRow
                      key={r.noteId}
                      note={{
                        id: r.noteId,
                        title: r.title,
                        confidence: r.similarity,
                      }}
                      onClick={() => navigateToNote(r.noteId)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <IndexStatusCard stats={indexStats} rebuilding={rebuilding} onReindex={handleReindex} />
      </div>
    </div>
  );
}
