/**
 * Knowledge page — index health + topics + semantic search in one view.
 *
 * Replaces the old flat topics list. The page is structured around three
 * questions a user wants answered fast:
 *
 *   1. Can I find something by meaning? (semantic search)
 *   2. What's in my workspace? (topics as a grid of cards, not a list)
 *   3. Can I find <something>? (prominent semantic search; results inline)
 *
 * Route is unchanged (`/topics`) so deep links stay valid. The sidebar
 * label is renamed to "Knowledge" with a Brain icon to match the broader
 * scope this page now covers.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  ArrowsClockwise,
  Brain,
  CaretRight,
  CloudArrowDown,
  MagnifyingGlass,
  Plus,
  WarningCircle,
} from '@phosphor-icons/react';
import { useNavigateToNote } from '@renderer/navigation';
import { useSidebarUI } from '@renderer/hooks/useUI';
import { useTopicsData } from '@renderer/hooks/useTopicsData';
import { useWorkspaceSync } from '@renderer/hooks/useWorkspaceSync';
import { useIndexStats } from '@renderer/hooks/useIndexStats';
import { IconButton, sizeHeightClasses } from '@renderer/components/composites';
import { Input } from '@renderer/components/base/ui/input';
import { Button } from '@renderer/components/base/ui/button';
import { Checkbox } from '@renderer/components/base/ui/checkbox';
import { cn } from '@renderer/lib/utils';
import { TopicRow } from '@renderer/components/features/Topics/TopicRow';
import { NoteRow } from '@renderer/components/features/Topics/NoteRow';
import { TopicNotesPanel } from '@renderer/components/features/Topics/TopicNotesPanel';
import { CreateTopicDialog } from '@renderer/components/features/Topics/CreateTopicDialog';
import { SuggestedTopicsSection } from '@renderer/components/features/Topics/SuggestedTopicsSection';

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

export default function TopicsPage() {
  const navigateToNote = useNavigateToNote();
  const { toggleSidebar, sidebarOpen } = useSidebarUI();
  const syncWorkspace = useWorkspaceSync();
  const [reconciling, setReconciling] = useState(false);

  const {
    topics,
    selectedTopicId,
    selectedTopic,
    topicNotes,
    searchResults,
    searchQuery,
    searchInput,
    error,
    initializing,
    loadingNotes,
    excludeJournal,
    setSearchInput,
    setExcludeJournal,
    handleTopicClick,
    handleCreateTopic,
    selectTopic,
  } = useTopicsData();

  const { stats: indexStats, rebuilding, rebuildAll } = useIndexStats();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicColor, setNewTopicColor] = useState('#6366f1');
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!newTopicName.trim()) return;
    setCreating(true);
    try {
      await handleCreateTopic(newTopicName, newTopicColor);
      setShowCreateDialog(false);
      setNewTopicName('');
    } finally {
      setCreating(false);
    }
  }, [newTopicName, newTopicColor, handleCreateTopic]);

  const handleReconcile = useCallback(async () => {
    if (reconciling) return;
    setReconciling(true);
    try {
      await syncWorkspace({ silent: false });
    } finally {
      setReconciling(false);
    }
  }, [reconciling, syncWorkspace]);

  const indexedPercent = useMemo(() => {
    if (!indexStats || indexStats.totalNotes === 0) return 0;
    return Math.round((indexStats.indexedNotes / indexStats.totalNotes) * 100);
  }, [indexStats]);

  const handleReindex = useCallback(async () => {
    await rebuildAll(false);
  }, [rebuildAll]);

  if (initializing) {
    return (
      <div className="flex h-full flex-col bg-background">
        <PageHeader
          sidebarOpen={sidebarOpen}
          toggleSidebar={toggleSidebar}
          indexedPercent={null}
          onCreate={() => setShowCreateDialog(true)}
          reconciling={reconciling}
          onReconcile={handleReconcile}
        />
        <div className="flex flex-1 items-center justify-center">
          <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <PageHeader
        sidebarOpen={sidebarOpen}
        toggleSidebar={toggleSidebar}
        indexedPercent={indexStats ? indexedPercent : null}
        onCreate={() => setShowCreateDialog(true)}
        reconciling={reconciling}
        onReconcile={handleReconcile}
      />

      <div className="flex flex-1 overflow-hidden">
        <div
          className={cn(
            'flex-1 overflow-y-auto',
            selectedTopicId && 'border-r border-border/60',
            selectedTopicId ? 'lg:max-w-[60%]' : '',
          )}
        >
          <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-8">
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <section className="space-y-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  Find something you remember
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Search by idea or meaning, even when you cannot remember the exact words.
                </p>
              </div>
              <div className="relative">
                <MagnifyingGlass
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="text"
                  placeholder="Find notes by meaning, not just keywords…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-12 rounded-xl border-border/70 bg-card pl-11 text-[15px] shadow-sm"
                />
              </div>
              {searchQuery && (
                <div className="overflow-hidden rounded-md border border-border/60">
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
                            confidence: 1 - r.distance,
                          }}
                          onClick={() => navigateToNote(r.noteId)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            <SuggestedTopicsSection />

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm font-medium text-foreground">
                  Your topics
                  {topics.length > 0 && (
                    <span className="ml-1.5 tabular-nums text-muted-foreground/70">
                      ({topics.length})
                    </span>
                  )}
                </div>
                <label
                  htmlFor="topics-exclude-journals"
                  className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Checkbox
                    id="topics-exclude-journals"
                    checked={excludeJournal}
                    onCheckedChange={(checked) => setExcludeJournal(checked === true)}
                  />
                  Exclude journals
                </label>
              </div>

              {topics.length === 0 ? (
                <EmptyTopicsCard onCreate={() => setShowCreateDialog(true)} />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {topics.map((topic) => (
                    <TopicRow
                      key={topic.id}
                      topic={topic}
                      onClick={() => handleTopicClick(topic.id)}
                      isSelected={topic.id === selectedTopicId}
                    />
                  ))}
                </div>
              )}
            </section>

            <IndexStatusCard stats={indexStats} rebuilding={rebuilding} onReindex={handleReindex} />
          </div>
        </div>

        {selectedTopicId && selectedTopic && (
          <TopicNotesPanel
            topic={selectedTopic}
            notes={topicNotes}
            loading={loadingNotes}
            onNoteClick={(id) => navigateToNote(id)}
            onClose={() => selectTopic(null)}
          />
        )}
      </div>

      <CreateTopicDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        name={newTopicName}
        setName={setNewTopicName}
        color={newTopicColor}
        setColor={setNewTopicColor}
        creating={creating}
        onCreate={handleCreate}
      />
    </div>
  );
}

interface PageHeaderProps {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  indexedPercent: number | null;
  reconciling: boolean;
  onCreate: () => void;
  onReconcile: () => void;
}

function PageHeader({
  sidebarOpen,
  toggleSidebar,
  indexedPercent,
  reconciling,
  onCreate,
  onReconcile,
}: PageHeaderProps) {
  const pillState =
    indexedPercent === null
      ? { label: 'Loading…', tone: 'muted' as const }
      : indexedPercent === 100
        ? { label: 'Indexed', tone: 'good' as const }
        : indexedPercent >= 80
          ? { label: `${indexedPercent}% indexed`, tone: 'good' as const }
          : indexedPercent >= 1
            ? { label: `${indexedPercent}% indexed`, tone: 'warn' as const }
            : { label: 'Not indexed', tone: 'warn' as const };

  return (
    <div
      className={cn(
        'shrink-0 border-b border-border bg-card px-4 flex items-center gap-3',
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
      <Brain size={16} className="text-muted-foreground" />
      <span className="text-sm font-medium">Knowledge</span>

      <div
        className={cn(
          'ml-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs tabular-nums',
          pillState.tone === 'good'
            ? 'border-border/70 bg-muted/40 text-muted-foreground'
            : pillState.tone === 'warn'
              ? 'border-border bg-muted/60 text-foreground'
              : 'border-border bg-muted/50 text-muted-foreground',
        )}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            pillState.tone === 'good'
              ? 'bg-muted-foreground/60'
              : pillState.tone === 'warn'
                ? 'bg-muted-foreground'
                : 'bg-muted-foreground/60',
          )}
          aria-hidden
        />
        {pillState.label}
      </div>

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="sm"
        disabled={reconciling}
        onClick={onReconcile}
        className="text-xs"
        title="Import any markdown files in the workspace folder that aren't tracked yet"
      >
        <CloudArrowDown size={14} className={cn(reconciling && 'animate-pulse')} />
        Reconcile
      </Button>
      <Button variant="ghost" size="sm" onClick={onCreate} className="text-xs">
        <Plus size={14} />
        New topic
      </Button>
    </div>
  );
}

function EmptyTopicsCard({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/60 px-4 py-10 text-center">
      <Brain size={20} className="text-muted-foreground" />
      <div className="text-sm text-foreground">No topics yet</div>
      <div className="max-w-xs text-xs text-muted-foreground text-pretty">
        Topics group notes by meaning using your embeddings. Create one to start clustering.
      </div>
      <Button variant="outline" size="sm" onClick={onCreate} className="mt-1">
        <Plus size={14} />
        Create your first topic
      </Button>
    </div>
  );
}
