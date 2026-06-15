/**
 * Knowledge page — index health + topics + semantic search in one view.
 *
 * Replaces the old flat topics list. The page is structured around three
 * questions a user wants answered fast:
 *
 *   1. Is my workspace fully indexed? (top: IndexStatusCard with progress bar)
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
  Sparkle,
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
  const chunks = stats?.chunkCount ?? 0;
  const percent = total > 0 ? Math.round((indexed / total) * 100) : 0;
  const isComplete = total > 0 && pending === 0 && failed === 0;

  const stateLabel = !stats
    ? 'Loading status…'
    : total === 0
      ? 'No notes to index'
      : pending === 0 && failed === 0
        ? `Every note is searchable across ${chunks.toLocaleString()} chunks`
        : failed > 0
          ? `${pending} pending · ${failed} failed`
          : `${pending} note${pending === 1 ? '' : 's'} pending`;

  return (
    <section className="rounded-xl border border-border bg-card/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Sparkle size={12} weight="fill" className="text-primary" />
            Semantic Index
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-foreground">{indexed}</span>
            <span className="text-sm text-muted-foreground tabular-nums">/ {total} notes</span>
            {chunks > 0 && (
              <span className="text-sm text-muted-foreground tabular-nums">
                · {chunks.toLocaleString()} chunks
              </span>
            )}
            <span className="text-sm text-muted-foreground tabular-nums">· {percent}%</span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{stateLabel}</div>
        </div>

        <Button
          size="sm"
          variant={isComplete ? 'ghost' : 'outline'}
          disabled={rebuilding}
          onClick={onReindex}
          title={
            isComplete
              ? 'Re-chunk and re-embed every note in this workspace'
              : 'Chunk and embed any pending notes'
          }
        >
          <ArrowsClockwise size={14} className={cn(rebuilding && 'animate-spin')} />
          {rebuilding ? 'Indexing…' : isComplete ? 'Reindex' : 'Index pending'}
        </Button>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            'h-full transition-[width,background-color] duration-300 ease-out',
            total === 0
              ? 'bg-muted-foreground/40'
              : percent === 100
                ? 'bg-green-500'
                : percent >= 80
                  ? 'bg-primary'
                  : 'bg-yellow-500',
          )}
          style={{ width: `${Math.max(percent, total > 0 ? 2 : 0)}%` }}
        />
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
          <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <IndexStatusCard
              stats={indexStats}
              rebuilding={rebuilding}
              onReindex={handleReindex}
            />

            <section className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Semantic search
              </div>
              <div className="relative">
                <MagnifyingGlass
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="text"
                  placeholder="Find notes by meaning, not just keywords…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9"
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

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Topics
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
                <div className="overflow-hidden rounded-md border border-border/60">
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
            ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400'
            : pillState.tone === 'warn'
              ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
              : 'border-border bg-muted/50 text-muted-foreground',
        )}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            pillState.tone === 'good'
              ? 'bg-green-500'
              : pillState.tone === 'warn'
                ? 'bg-yellow-500'
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
