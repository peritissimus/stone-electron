import { useJournalTimeline } from '@renderer/features/journals/hooks/useJournalTimeline';
import { ViewHeader } from '@renderer/components/composites';
import { Skeleton } from '@renderer/components/base/ui/skeleton';
import { JournalEntrySection } from '@renderer/features/journals/views/components/JournalEntrySection';
import { useViewScrollRestoration } from '@renderer/services/view-state/hooks/useViewScrollRestoration';

function JournalSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="border-b border-border/30 py-8">
          <Skeleton className="mb-4 h-8 w-64" />
          <Skeleton className="mb-2 h-4 w-11/12" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export default function JournalsView() {
  const scrollRef = useViewScrollRestoration('journals');
  const { entries, loading, loadedOnce, error, handleEntryOpen, handleMaterialize } =
    useJournalTimeline();

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <ViewHeader title="Journals" />

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[48rem] px-4 pb-16 pt-3 sm:px-8">
          {loading && !loadedOnce ? (
            <JournalSkeleton />
          ) : (
            <>
              {error && (
                <div className="my-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              {entries.map((entry) => (
                <JournalEntrySection
                  key={entry.date}
                  entry={entry}
                  onOpen={handleEntryOpen}
                  onMaterialize={handleMaterialize}
                />
              ))}

              {loadedOnce && entries.length === 0 && (
                <div className="py-10 text-center text-sm text-muted-foreground">No journals</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
