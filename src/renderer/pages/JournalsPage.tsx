import { CaretRight } from '@phosphor-icons/react';
import { useJournalTimeline } from '@renderer/hooks/useJournalTimeline';
import { useSidebarUI } from '@renderer/hooks/useUI';
import { IconButton, sizeHeightClasses } from '@renderer/components/composites';
import { Skeleton } from '@renderer/components/base/ui/skeleton';
import { JournalEntrySection } from '@renderer/components/features/Journals/JournalEntrySection';
import { cn } from '@renderer/lib/utils';

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

export default function JournalsPage() {
  const { toggleSidebar, sidebarOpen } = useSidebarUI();
  const { entries, loading, loadedOnce, error, handleEntryOpen, handleMaterialize } =
    useJournalTimeline();

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div
        className={cn(
          'border-b border-border/40 bg-background px-4 flex items-center gap-3 shrink-0',
          sizeHeightClasses.spacious,
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
        <h1 className="text-sm font-medium text-muted-foreground">Journals</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[54rem] px-4 pb-16 pt-3 sm:px-8">
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
