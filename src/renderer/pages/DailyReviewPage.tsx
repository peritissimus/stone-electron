/**
 * DailyReviewPage — /today route. One page that surfaces:
 *   • Today's journal entry (preview + open)
 *   • Today's meetings (with status + jump-to-detail)
 *   • Open tasks (across all notes, sorted by recency)
 *   • Captures (last 24h, max 8)
 *   • On this day (notes from prior years on this calendar day)
 *
 * Read-only aggregation — every action navigates somewhere else.
 * Refresh is silent (auto on note events); no manual reload button.
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sun,
  CaretRight,
  BookOpen,
  CheckSquare,
  Microphone,
  Clock,
  ArrowClockwise,
  Calendar,
  Sparkle,
} from '@phosphor-icons/react';
import { cn } from '@renderer/lib/utils';
import { Button } from '@renderer/components/base/ui/button';
import { IconButton, sizeHeightClasses } from '@renderer/components/composites';
import { useSidebarUI } from '@renderer/hooks/useUI';
import { useDailyReview } from '@renderer/hooks/useDailyReview';
import { useStatusReport } from '@renderer/hooks/useStatusReport';
import { useVoiceCaptureTrigger } from '@renderer/hooks/useVoiceCapture';
import { toNote } from '@renderer/navigation';
import { StatusReportDialog } from '@renderer/components/features/DailyReview/StatusReportDialog';
import type {
  DailyReviewMeetingSummary,
  DailyReviewOnThisDayEntry,
  DailyReviewSnapshot,
  Note,
  TodoItem,
} from '@shared/types';

export default function DailyReviewPage() {
  const { toggleSidebar, sidebarOpen } = useSidebarUI();
  const { snapshot, loading, loadedOnce, refreshing, error, reload } = useDailyReview();
  const { openAndGenerate: openStatusReport } = useStatusReport();
  const { openVoiceCapture } = useVoiceCaptureTrigger();

  const headerDate = useMemo(() => formatHeaderDate(snapshot?.date ?? todayIso()), [
    snapshot?.date,
  ]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header
        className={cn(
          'flex shrink-0 items-center gap-3 border-b border-border bg-card px-4',
          sizeHeightClasses['spacious'],
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
        <Sun size={16} className="shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="shrink-0 text-sm font-semibold">Today</h1>
          <span className="truncate text-xs text-muted-foreground tabular-nums">{headerDate}</span>
        </div>
        <div className="flex-1" />
        {refreshing && (
          <span className="shrink-0 text-[11px] text-muted-foreground">Refreshing…</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void reload()}
          className="shrink-0 text-xs"
        >
          <ArrowClockwise size={14} />
          Refresh
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={openVoiceCapture}
          className="shrink-0 text-xs"
          title="Record a voice note — transcribed locally and saved to today's journal"
        >
          <Microphone size={14} weight="fill" />
          Voice note
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void openStatusReport()}
          className="shrink-0 text-xs"
          title="Draft a weekly status report from the last 7 days of journal, meetings, completed tasks, and modified notes"
        >
          <Sparkle size={14} weight="fill" />
          Weekly status
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto max-w-3xl px-8 py-7">
          {!loadedOnce && loading && <PageSkeleton />}
          {error && <ErrorBox message={error} />}
          {snapshot && <Sections snapshot={snapshot} />}
        </div>
      </div>

      <StatusReportDialog />
    </div>
  );
}

// =============================================================================
// Sections
// =============================================================================

function Sections({ snapshot }: { snapshot: DailyReviewSnapshot }) {
  const navigate = useNavigate();
  const goToNote = (id: string) => navigate(toNote(id));

  const empty =
    !snapshot.todayJournal.noteId &&
    snapshot.todayMeetings.length === 0 &&
    snapshot.openTasks.length === 0 &&
    snapshot.recentNotes.length === 0 &&
    snapshot.onThisDay.length === 0;

  if (empty) return <EmptyAllSections />;

  return (
    <div className="space-y-7">
      <JournalSection journal={snapshot.todayJournal} onOpen={goToNote} />
      {snapshot.todayMeetings.length > 0 && (
        <MeetingsSection meetings={snapshot.todayMeetings} />
      )}
      {snapshot.openTasks.length > 0 && (
        <TasksSection tasks={snapshot.openTasks} onOpenNote={goToNote} />
      )}
      {snapshot.recentNotes.length > 0 && (
        <RecentSection notes={snapshot.recentNotes} onOpen={goToNote} />
      )}
      {snapshot.onThisDay.length > 0 && (
        <OnThisDaySection entries={snapshot.onThisDay} onOpen={goToNote} />
      )}
    </div>
  );
}

function JournalSection({
  journal,
  onOpen,
}: {
  journal: DailyReviewSnapshot['todayJournal'];
  onOpen: (id: string) => void;
}) {
  const has = Boolean(journal.noteId);
  return (
    <section>
      <SectionLabel icon={<BookOpen size={12} />}>Today's journal</SectionLabel>
      {has ? (
        <button
          type="button"
          onClick={() => journal.noteId && onOpen(journal.noteId)}
          className={cn(
            'mt-2 w-full rounded-xl border border-border bg-card px-5 py-4 text-left',
            'shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
            'transition-[transform,background-color] duration-150 hover:bg-muted/30 active:scale-[0.998]',
          )}
        >
          {journal.contentPreview ? (
            <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {journal.contentPreview}
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground/80">Empty entry — open to start writing.</p>
          )}
        </button>
      ) : (
        <p className="mt-2 rounded-xl border border-dashed border-border/60 bg-muted/20 px-5 py-4 text-sm italic text-muted-foreground/80">
          No journal entry for today yet. The next quick-capture you make will create it.
        </p>
      )}
    </section>
  );
}

function MeetingsSection({ meetings }: { meetings: DailyReviewMeetingSummary[] }) {
  return (
    <section>
      <SectionLabel icon={<Microphone size={12} />}>
        Today's meetings{' '}
        <span className="ml-1 text-muted-foreground/70 tabular-nums">({meetings.length})</span>
      </SectionLabel>
      <ul className="mt-2 space-y-1.5">
        {meetings.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
          >
            <MeetingStatusDot status={m.status} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{m.title}</div>
              {m.summary && (
                <div className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">
                  {firstBullet(m.summary)}
                </div>
              )}
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {formatDuration(m.durationMs)}
            </span>
            {m.inJournal && (
              <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-px text-[10px] font-medium text-emerald-600">
                journaled
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function TasksSection({
  tasks,
  onOpenNote,
}: {
  tasks: TodoItem[];
  onOpenNote: (id: string) => void;
}) {
  const top = tasks.slice(0, 8);
  return (
    <section>
      <SectionLabel icon={<CheckSquare size={12} />}>
        Open tasks{' '}
        <span className="ml-1 text-muted-foreground/70 tabular-nums">({tasks.length})</span>
      </SectionLabel>
      <ul className="mt-2 space-y-1">
        {top.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => onOpenNote(task.noteId)}
              className={cn(
                'group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left',
                'transition-colors duration-150 hover:bg-muted',
              )}
            >
              <span className="mt-0.5 inline-block size-3.5 shrink-0 rounded border border-border" />
              <span className="min-w-0 flex-1 text-sm">
                <span className="text-foreground">{task.text}</span>
                {task.noteTitle && (
                  <span className="ml-2 text-[11px] text-muted-foreground/70">
                    {task.noteTitle}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  'shrink-0 rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider',
                  stateChip(task.state),
                )}
              >
                {task.state}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {tasks.length > top.length && (
        <p className="mt-2 px-2 text-[11px] text-muted-foreground">
          +{tasks.length - top.length} more on the Tasks page
        </p>
      )}
    </section>
  );
}

function RecentSection({
  notes,
  onOpen,
}: {
  notes: Note[];
  onOpen: (id: string) => void;
}) {
  return (
    <section>
      <SectionLabel icon={<Clock size={12} />}>Recently edited (24h)</SectionLabel>
      <ul className="mt-2 space-y-1">
        {notes.map((note) => (
          <li key={note.id}>
            <button
              type="button"
              onClick={() => onOpen(note.id)}
              className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-muted"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {note.title || 'Untitled'}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {formatRelative(note.updatedAt)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OnThisDaySection({
  entries,
  onOpen,
}: {
  entries: DailyReviewOnThisDayEntry[];
  onOpen: (id: string) => void;
}) {
  return (
    <section>
      <SectionLabel icon={<Calendar size={12} />}>On this day</SectionLabel>
      <ul className="mt-2 space-y-1">
        {entries.map((entry) => (
          <li key={entry.note.id}>
            <button
              type="button"
              onClick={() => onOpen(entry.note.id)}
              className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-muted"
            >
              <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground tabular-nums">
                {entry.yearsAgo}y ago
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {entry.note.title || 'Untitled'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// =============================================================================
// Bits
// =============================================================================

function SectionLabel({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {icon}
      <span>{children}</span>
    </h2>
  );
}

const MEETING_STATUS_TONE: Record<DailyReviewMeetingSummary['status'], string> = {
  ready: 'bg-emerald-500/15 text-emerald-600',
  failed: 'bg-destructive/15 text-destructive',
  recording: 'bg-primary/15 text-primary animate-pulse',
  transcribing: 'bg-primary/15 text-primary animate-pulse',
  summarizing: 'bg-primary/15 text-primary animate-pulse',
};

function MeetingStatusDot({ status }: { status: DailyReviewMeetingSummary['status'] }) {
  return <span className={cn('size-2 shrink-0 rounded-full', MEETING_STATUS_TONE[status])} />;
}

function stateChip(state: TodoItem['state']): string {
  switch (state) {
    case 'doing':
      return 'bg-primary/15 text-primary';
    case 'waiting':
      return 'bg-amber-500/15 text-amber-600';
    case 'hold':
      return 'bg-muted text-muted-foreground';
    case 'idea':
      return 'bg-blue-500/15 text-blue-600';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function EmptyAllSections() {
  return (
    <div className="mt-12 flex flex-col items-center justify-center text-center text-muted-foreground">
      <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground/60">
        <Sun size={24} />
      </div>
      <p className="text-balance text-sm">
        Nothing today yet — open a quick capture, record a meeting, or create a note from a
        template to get started.
      </p>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-14 animate-pulse rounded-xl bg-muted/60" />
        </div>
      ))}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}

// =============================================================================
// Date / duration helpers
// =============================================================================

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatHeaderDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return mm > 0 ? `${mm}m ${ss}s` : `${ss}s`;
}

function formatRelative(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function firstBullet(summary: string): string {
  const line = summary.split('\n').find((l) => l.trim().startsWith('-'));
  if (!line) return summary.split('\n')[0] ?? '';
  return line.replace(/^\s*-\s*\[?\s?\]?\s*/, '').trim();
}
