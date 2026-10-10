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

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { todayIso } from '@renderer/lib/dateFormat';
import { useViewScrollRestoration } from '@renderer/services/view-state/hooks/useViewScrollRestoration';
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
  MagicWand,
  Envelope,
  Kanban,
  X,
  CircleNotch,
  FloppyDisk,
  Warning,
} from '@phosphor-icons/react';
import { cn } from '@renderer/lib/utils';
import { formatCount, formatDuration, formatRelative } from '../lib/formatDailyReview';
import {
  DailyReviewDetailsDialog,
  type DailyReviewDetail,
  type ShowDailyReviewDetail,
} from './components/DailyReviewDetailsDialog';
import { renderMarkdown } from '@renderer/features/notes/editor/renderMarkdown';
import { Button } from '@renderer/components/base/ui/button';
import { ViewHeader } from '@renderer/components/composites';
import {
  useDailyReview,
  type DailyReviewIntegrationStates,
  type IntegrationLoadState,
} from '@renderer/features/daily-review/hooks/useDailyReview';
import { useStatusReport } from '@renderer/features/daily-review/hooks/useStatusReport';
import { useVoiceCaptureTrigger } from '@renderer/features/voice-capture/hooks/useVoiceCapture';
import { toNote, toSettings } from '@renderer/services/navigation';
import { StatusReportDialog } from '@renderer/features/daily-review/views/components/StatusReportDialog';
import type {
  CalendarEvent,
  DailyReviewMeetingSummary,
  DailyReviewOnThisDayEntry,
  DailyReviewSnapshot,
  LinearIssue,
  MailMessage,
  Note,
  TodoItem,
} from '@shared/types';

/**
 * Header actions all drop their labels at the same width, so the row never
 * mixes labelled pills with icon-only buttons.
 *
 * Collapsing the label has to collapse the padding too — otherwise the button
 * keeps `px-2.5` and renders as a 34×32 lozenge instead of a square. `size-3.5`
 * restores the 14px icon the call sites ask for; the base button forces
 * `size-4` on any nested svg.
 *
 * These breakpoint variants are written out in full: Tailwind only generates
 * classes it can find as literals in the source, so building them by
 * interpolation silently produces no CSS.
 */
const HEADER_ACTION =
  'shrink-0 text-xs [&_svg]:size-3.5 max-[1100px]:w-8 max-[1100px]:justify-center max-[1100px]:px-0';

const HEADER_ACTION_LABEL = 'max-[1100px]:sr-only';

export default function DailyReviewView() {
  const scrollRef = useViewScrollRestoration('daily-review');
  const {
    snapshot,
    loading,
    loadedOnce,
    refreshing,
    error,
    integrations,
    retryIntegration,
    reload,
    summary,
    summarizing,
    summaryError,
    summarize,
    clearSummary,
  } = useDailyReview();
  const { openAndGenerate: openStatusReport } = useStatusReport();
  const { openVoiceCapture } = useVoiceCaptureTrigger();

  const headerDate = useMemo(
    () => formatHeaderDate(snapshot?.date ?? todayIso()),
    [snapshot?.date],
  );

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <ViewHeader
        title="Today"
        meta={headerDate}
        actions={
          <>
            {refreshing && (
              <span className="shrink-0 text-[0.6875rem] text-muted-foreground">Refreshing…</span>
            )}
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void reload()}
                disabled={refreshing}
                className={HEADER_ACTION}
                aria-label="Refresh today"
                title="Refresh today"
              >
                <ArrowClockwise className={refreshing ? 'animate-spin' : undefined} />
                <span className={HEADER_ACTION_LABEL}>Refresh</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={openVoiceCapture}
                className={HEADER_ACTION}
                aria-label="Record voice note"
                title="Record a voice note — transcribed locally and saved to today's journal"
              >
                <Microphone weight="fill" />
                <span className={HEADER_ACTION_LABEL}>Voice note</span>
              </Button>

              {/* The two generative actions read as their own group. */}
              <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />

              <Button
                variant="ghost"
                size="sm"
                onClick={() => void summarize(false)}
                disabled={summarizing}
                className={HEADER_ACTION}
                aria-label="Summarize day"
                title="Summarize today from your journal, meetings, tasks, calendar, mail, and Linear (local or configured AI)"
              >
                {summarizing ? (
                  <CircleNotch className="animate-spin" />
                ) : (
                  <MagicWand weight="fill" />
                )}
                <span className={HEADER_ACTION_LABEL}>Summarize day</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void openStatusReport()}
                className={HEADER_ACTION}
                aria-label="Create weekly status"
                title="Draft a weekly status report from the last 7 days of journal, meetings, completed tasks, and modified notes"
              >
                <Sparkle weight="fill" />
                <span className={HEADER_ACTION_LABEL}>Weekly status</span>
              </Button>
            </div>
          </>
        }
      />

      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-3xl px-8 py-7 max-[900px]:px-4 max-[900px]:py-5">
          {!loadedOnce && loading && <PageSkeleton />}
          {error && <ErrorBox message={error} />}
          {(summary || summaryError) && (
            <DaySummaryCard
              summary={summary}
              error={summaryError}
              saving={summarizing}
              onSave={() => void summarize(true)}
              onDismiss={clearSummary}
            />
          )}
          {snapshot && (
            <Sections
              snapshot={snapshot}
              integrations={integrations}
              onRetryIntegration={retryIntegration}
            />
          )}
        </div>
      </div>

      <StatusReportDialog />
    </div>
  );
}

// =============================================================================
// Sections
// =============================================================================

function Sections({
  snapshot,
  integrations,
  onRetryIntegration,
}: {
  snapshot: DailyReviewSnapshot;
  integrations: DailyReviewIntegrationStates;
  onRetryIntegration: (source: 'calendar' | 'mail' | 'linear') => Promise<void>;
}) {
  const navigate = useNavigate();
  const goToNote = (id: string) => navigate(toNote(id));
  const [detail, setDetail] = useState<DailyReviewDetail | null>(null);
  const detailTrigger = useRef<HTMLElement | null>(null);
  const showDetail: ShowDailyReviewDetail = (nextDetail, trigger) => {
    detailTrigger.current = trigger;
    setDetail(nextDetail);
  };

  const calendarEvents = snapshot.calendarEvents ?? [];
  const mailUnreadCount = snapshot.mailUnreadCount ?? 0;
  const mailMessages = snapshot.mailMessages ?? [];
  const linearIssues = snapshot.linearIssues ?? [];

  const empty =
    !snapshot.todayJournal.noteId &&
    snapshot.todayMeetings.length === 0 &&
    snapshot.openTasks.length === 0 &&
    snapshot.recentNotes.length === 0 &&
    snapshot.onThisDay.length === 0 &&
    calendarEvents.length === 0 &&
    mailUnreadCount === 0 &&
    mailMessages.length === 0 &&
    linearIssues.length === 0;

  const showingIntegrationState = [
    integrations.calendar,
    integrations.mail,
    integrations.linear,
  ].some(
    (integration) =>
      integration.status === 'loading' ||
      integration.status === 'denied' ||
      integration.status === 'error',
  );

  if (empty && !showingIntegrationState) return <EmptyAllSections />;

  return (
    <div className="space-y-7">
      <JournalSection
        journal={snapshot.todayJournal}
        onOpen={goToNote}
        onStartWriting={() => navigate('/journals')}
      />
      {calendarEvents.length === 0 && isActionableIntegrationState(integrations.calendar) && (
        <IntegrationStatusSection
          label="Calendar"
          icon={<Calendar size={12} />}
          state={integrations.calendar}
          onRetry={() => void onRetryIntegration('calendar')}
          onManage={() => navigate(toSettings('integrations'))}
        />
      )}
      {calendarEvents.length > 0 && (
        <CalendarSection events={calendarEvents} onShowDetail={showDetail} />
      )}
      {snapshot.todayMeetings.length > 0 && (
        <MeetingsSection meetings={snapshot.todayMeetings} onShowDetail={showDetail} />
      )}
      {linearIssues.length === 0 && isActionableIntegrationState(integrations.linear) && (
        <IntegrationStatusSection
          label="Linear"
          icon={<Kanban size={12} />}
          state={integrations.linear}
          onRetry={() => void onRetryIntegration('linear')}
          onManage={() => navigate(toSettings('integrations'))}
        />
      )}
      {linearIssues.length > 0 && <LinearSection issues={linearIssues} onShowDetail={showDetail} />}
      {mailMessages.length === 0 && isActionableIntegrationState(integrations.mail) && (
        <IntegrationStatusSection
          label="Mail"
          icon={<Envelope size={12} />}
          state={integrations.mail}
          onRetry={() => void onRetryIntegration('mail')}
          onManage={() => navigate(toSettings('integrations'))}
        />
      )}
      {(mailUnreadCount > 0 || mailMessages.length > 0) && (
        <MailSection
          unreadCount={mailUnreadCount}
          messages={mailMessages}
          onShowDetail={showDetail}
        />
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
      <DailyReviewDetailsDialog
        detail={detail}
        onClose={() => setDetail(null)}
        returnFocus={() => detailTrigger.current?.focus()}
      />
    </div>
  );
}

function isActionableIntegrationState(state: IntegrationLoadState): boolean {
  return state.status === 'loading' || state.status === 'denied' || state.status === 'error';
}

function IntegrationStatusSection({
  label,
  icon,
  state,
  onRetry,
  onManage,
}: {
  label: string;
  icon: ReactNode;
  state: IntegrationLoadState;
  onRetry: () => void;
  onManage: () => void;
}) {
  const loading = state.status === 'loading';
  const denied = state.status === 'denied';

  return (
    <section>
      <SectionLabel icon={icon}>{label}</SectionLabel>
      <div className="flex min-h-14 flex-wrap items-center gap-3 rounded-xl bg-muted/35 px-3 py-2.5 shadow-[inset_0_0_0_1px_hsl(var(--border)/0.3)]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm">
          {loading ? (
            <CircleNotch size={14} className="animate-spin" />
          ) : (
            <Warning size={14} weight="fill" className="text-amber-500" />
          )}
        </div>
        <div className="min-w-0 flex-1 basis-40 [overflow-wrap:anywhere]">
          <p className="text-xs font-medium">
            {loading
              ? `Checking ${label}…`
              : denied
                ? `${label} access is off`
                : `${label} needs attention`}
          </p>
          {!loading && (
            <p className="mt-0.5 text-xs text-muted-foreground text-pretty">
              {state.message ?? `Stone could not read ${label}.`}
            </p>
          )}
        </div>
        {!loading && (
          <div className="flex max-w-full flex-wrap items-center gap-1">
            <Button variant="ghost" size="sm" className="h-10" onClick={onRetry}>
              Try again
            </Button>
            <Button variant="outline" size="sm" className="h-10" onClick={onManage}>
              Manage access
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function JournalSection({
  journal,
  onOpen,
  onStartWriting,
}: {
  journal: DailyReviewSnapshot['todayJournal'];
  onOpen: (id: string) => void;
  onStartWriting: () => void;
}) {
  const has = journal.exists;
  return (
    <section>
      <SectionLabel icon={<BookOpen size={12} />}>Today's journal</SectionLabel>
      {has ? (
        <button
          type="button"
          onClick={() => (journal.noteId ? onOpen(journal.noteId) : onStartWriting())}
          className={cn(
            'mt-2 w-full rounded-xl border border-border bg-card px-5 py-4 text-left',
            'shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
            'transition-[transform,background-color] duration-150 hover:bg-muted/30 active:scale-[0.998]',
          )}
        >
          {journal.contentPreview ? (
            <p className="line-clamp-4 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm leading-relaxed text-foreground/90">
              {journal.contentPreview}
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground/80">
              Empty entry — open to start writing.
            </p>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={onStartWriting}
          className={cn(
            'group mt-2 flex w-full items-center justify-between gap-4 rounded-xl bg-muted/25 px-5 py-4 text-left',
            'shadow-[inset_0_0_0_1px_hsl(var(--border)/0.35)]',
            'transition-[background-color,box-shadow,transform] duration-150 hover:bg-muted/40 hover:shadow-[inset_0_0_0_1px_hsl(var(--border)/0.55)] active:scale-[0.99]',
          )}
        >
          <span>
            <span className="block text-sm font-medium text-foreground/90">
              Write today’s entry
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              Capture what mattered while the day is still fresh.
            </span>
          </span>
          <CaretRight
            size={15}
            className="shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
          />
        </button>
      )}
    </section>
  );
}

const DETAIL_ROW =
  'w-full min-h-10 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const PREVIEW_TITLE = 'line-clamp-2 [overflow-wrap:anywhere] text-foreground';

function MeetingsSection({
  meetings,
  onShowDetail,
}: {
  meetings: DailyReviewMeetingSummary[];
  onShowDetail: ShowDailyReviewDetail;
}) {
  return (
    <section>
      <SectionLabel icon={<Microphone size={12} />}>
        Today's meetings{' '}
        <span className="ml-1 text-muted-foreground/70 tabular-nums">
          ({formatCount(meetings.length)})
        </span>
      </SectionLabel>
      <ul className="mt-2 space-y-1.5">
        {meetings.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              title={m.title}
              className={cn(
                DETAIL_ROW,
                'flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5',
              )}
              onClick={(event) =>
                onShowDetail(
                  {
                    kind: 'Meeting',
                    title: m.title.trim() || 'Untitled meeting',
                    fields: [
                      { label: 'Duration', value: formatDuration(m.durationMs) },
                      { label: 'Status', value: m.status },
                      ...(m.inJournal ? [{ label: 'Journal', value: 'Added to journal' }] : []),
                    ],
                    body: m.summary,
                  },
                  event.currentTarget,
                )
              }
            >
              <span className="mt-1.5 flex">
                <MeetingStatusDot status={m.status} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn(PREVIEW_TITLE, 'font-medium')}>
                  {m.title.trim() || 'Untitled meeting'}
                </span>
                {m.summary && (
                  <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    {firstBullet(m.summary)}
                  </span>
                )}
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-muted-foreground">
                  <span className="tabular-nums">{formatDuration(m.durationMs)}</span>
                  <span className="capitalize">{m.status}</span>
                  {m.inJournal && (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-px text-[0.625rem] font-medium text-emerald-600">
                      journaled
                    </span>
                  )}
                </span>
              </span>
            </button>
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
        <span className="ml-1 text-muted-foreground/70 tabular-nums">
          ({formatCount(tasks.length)})
        </span>
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
              <span className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">
                <span className="text-foreground">{task.text}</span>
                {task.noteTitle?.trim() && (
                  <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground/70">
                    {task.noteTitle}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  'shrink-0 rounded px-1.5 py-px text-[0.5625rem] font-semibold uppercase tracking-wider',
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
        <p className="mt-2 px-2 text-[0.6875rem] text-muted-foreground">
          +{formatCount(tasks.length - top.length)} more on the Tasks page
        </p>
      )}
    </section>
  );
}

function RecentSection({ notes, onOpen }: { notes: Note[]; onOpen: (id: string) => void }) {
  return (
    <section>
      <SectionLabel icon={<Clock size={12} />}>Recently edited (24h)</SectionLabel>
      <ul className="mt-2 space-y-1">
        {notes.map((note) => (
          <li key={note.id}>
            <button
              type="button"
              title={note.title?.trim() || 'Untitled'}
              onClick={() => onOpen(note.id)}
              className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-muted"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {note.title?.trim() || 'Untitled'}
              </span>
              <span className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">
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
              title={entry.note.title?.trim() || 'Untitled'}
              onClick={() => onOpen(entry.note.id)}
              className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-muted"
            >
              <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[0.625rem] font-medium text-muted-foreground tabular-nums">
                {entry.yearsAgo}y ago
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {entry.note.title?.trim() || 'Untitled'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CalendarSection({
  events,
  onShowDetail,
}: {
  events: CalendarEvent[];
  onShowDetail: ShowDailyReviewDetail;
}) {
  return (
    <section>
      <SectionLabel icon={<Calendar size={12} />}>
        Calendar{' '}
        <span className="ml-1 text-muted-foreground/70 tabular-nums">
          ({formatCount(events.length)})
        </span>
      </SectionLabel>
      <ul className="mt-2 space-y-1">
        {events.map((e, i) => (
          <li key={`${e.start}-${i}`}>
            <button
              type="button"
              title={e.title}
              className={cn(DETAIL_ROW, 'flex flex-wrap items-start gap-x-3 gap-y-1')}
              onClick={(event) =>
                onShowDetail(
                  {
                    kind: 'Calendar event',
                    title: e.title.trim() || 'Untitled event',
                    fields: [
                      {
                        label: 'Starts',
                        value: e.allDay ? 'All day' : new Date(e.start).toLocaleString(),
                      },
                      { label: 'Ends', value: new Date(e.end).toLocaleString() },
                      { label: 'Calendar', value: e.calendar },
                      ...(e.location?.trim() ? [{ label: 'Location', value: e.location }] : []),
                    ],
                  },
                  event.currentTarget,
                )
              }
            >
              <span className="w-24 shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">
                {e.allDay ? 'all day' : formatClock(e.start)}
              </span>
              <span className="min-w-0 flex-1 basis-48">
                <span className={PREVIEW_TITLE}>{e.title.trim() || 'Untitled event'}</span>
                {e.location?.trim() && (
                  <span className="mt-0.5 line-clamp-2 text-[0.6875rem] text-muted-foreground/70 [overflow-wrap:anywhere]">
                    {e.location}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LinearSection({
  issues,
  onShowDetail,
}: {
  issues: LinearIssue[];
  onShowDetail: ShowDailyReviewDetail;
}) {
  return (
    <section>
      <SectionLabel icon={<Kanban size={12} />}>
        Linear{' '}
        <span className="ml-1 text-muted-foreground/70 tabular-nums">
          ({formatCount(issues.length)})
        </span>
      </SectionLabel>
      <ul className="mt-2 space-y-1">
        {issues.map((issue) => (
          <li key={issue.identifier}>
            <button
              type="button"
              title={issue.title}
              className={DETAIL_ROW}
              onClick={(event) =>
                onShowDetail(
                  {
                    kind: 'Linear issue',
                    title: issue.title.trim() || 'Untitled issue',
                    fields: [
                      { label: 'Identifier', value: issue.identifier },
                      { label: 'State', value: issue.state },
                      ...(issue.dueDate ? [{ label: 'Due', value: issue.dueDate }] : []),
                      { label: 'URL', value: issue.url },
                    ],
                  },
                  event.currentTarget,
                )
              }
            >
              <span className={PREVIEW_TITLE}>{issue.title.trim() || 'Untitled issue'}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 [overflow-wrap:anywhere]">
                <span className="min-w-0 font-mono text-[0.6875rem] text-muted-foreground">
                  {issue.identifier}
                </span>
                {issue.dueDate && (
                  <span className="text-[0.6875rem] tabular-nums text-amber-600">
                    due {issue.dueDate}
                  </span>
                )}
                <span className="min-w-0 rounded bg-muted px-1.5 py-px text-[0.625rem] text-muted-foreground">
                  {issue.state}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MailSection({
  unreadCount,
  messages,
  onShowDetail,
}: {
  unreadCount: number;
  messages: MailMessage[];
  onShowDetail: ShowDailyReviewDetail;
}) {
  const count = Math.max(unreadCount, messages.length);
  return (
    <section>
      <SectionLabel icon={<Envelope size={12} />}>
        Unread mail{' '}
        <span className="ml-1 text-muted-foreground/70 tabular-nums">({formatCount(count)})</span>
      </SectionLabel>
      {messages.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {messages.map((m, i) => (
            <li key={`${m.receivedAt}-${i}`}>
              <button
                type="button"
                title={m.subject.trim() || '(No subject)'}
                className={DETAIL_ROW}
                onClick={(event) =>
                  onShowDetail(
                    {
                      kind: 'Mail message',
                      title: m.subject.trim() || '(No subject)',
                      fields: [
                        { label: 'From', value: m.sender.trim() || 'Unknown sender' },
                        { label: 'Received', value: new Date(m.receivedAt).toLocaleString() },
                      ],
                    },
                    event.currentTarget,
                  )
                }
              >
                <span className={PREVIEW_TITLE}>{m.subject.trim() || '(No subject)'}</span>
                <span className="mt-0.5 line-clamp-2 text-[0.6875rem] text-muted-foreground/70 [overflow-wrap:anywhere]">
                  {m.sender.trim() || 'Unknown sender'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 px-2 text-xs text-muted-foreground">
          Apple Mail is connected. Message previews require a direct mail provider connection.
        </p>
      )}
    </section>
  );
}

function DaySummaryCard({
  summary,
  error,
  saving,
  onSave,
  onDismiss,
}: {
  summary: string | null;
  error: string | null;
  saving: boolean;
  onSave: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mb-7 rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel icon={<MagicWand size={12} />}>Day summary</SectionLabel>
        <div className="flex items-center gap-1.5">
          {summary && (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded text-[0.6875rem] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <FloppyDisk size={12} />
              Save to journal
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss summary"
            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X size={13} />
          </button>
        </div>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      ) : summary ? (
        <article
          className="prose prose-sm mt-2 max-w-none [overflow-wrap:anywhere] text-sm leading-relaxed text-foreground"
          // Our own AI output, rendered with html:false (escaped) — safe.
          dangerouslySetInnerHTML={{ __html: renderMarkdown(summary) }}
        />
      ) : null}
    </div>
  );
}

// =============================================================================
// Bits
// =============================================================================

function SectionLabel({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
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
        Nothing today yet — open a quick capture, record a meeting, or create a note from a template
        to get started.
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

function formatHeaderDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function firstBullet(summary: string): string {
  const line = summary.split('\n').find((l) => l.trim().startsWith('-'));
  if (!line) return summary.split('\n')[0] ?? '';
  return line.replace(/^\s*-\s*\[?\s?\]?\s*/, '').trim();
}
