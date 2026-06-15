/**
 * MeetingsPage — management surface for past meeting recordings.
 *
 * Two-pane layout with a list of recordings on the left and a detail
 * panel on the right. Re-summarize updates the row only; Send-to-journal
 * is the explicit publish action; delete is a confirm-on-second-click
 * inline action to avoid the native window.confirm popup.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Microphone,
  CaretRight,
  CaretDown,
  ArrowsClockwise,
  PaperPlaneTilt,
  Trash,
  Warning,
  Check,
  CircleNotch,
  Waveform,
  Play,
  Pause,
  Copy,
} from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@renderer/lib/utils';
import { renderMarkdown } from '@renderer/lib/renderMarkdown';
import { Button } from '@renderer/components/base/ui/button';
import { IconButton, sizeHeightClasses } from '@renderer/components/composites';
import { useSidebarUI } from '@renderer/hooks/useUI';
import { useMeetings } from '@renderer/hooks/useMeetings';
import { useMeetingRecorder } from '@renderer/hooks/useMeetingRecorder';
import { useMeetingPlayback, type MeetingPlayback } from '@renderer/hooks/useMeetingPlayback';
import { InlineRecordingPanel } from './InlineRecordingPanel';
import { toNote } from '@renderer/navigation';
import type { MeetingRecording, MeetingRecordingStatus } from '@shared/types';

export function MeetingsPage() {
  const { toggleSidebar, sidebarOpen } = useSidebarUI();
  const navigate = useNavigate();
  const {
    recordings,
    loading,
    loadedOnce,
    error,
    selected,
    select,
    resummarize,
    retranscribe,
    sendToJournal,
    remove,
    isBusy,
  } = useMeetings();
  const { openDock, start } = useMeetingRecorder();

  // On the Meetings page the recorder is inline (InlineRecordingPanel), so a
  // single click both reveals the panel and starts capturing.
  const startRecording = useCallback(() => {
    openDock();
    void start();
  }, [openDock, start]);

  const handleResummarize = useCallback(
    (id: string) => {
      void resummarize(id);
    },
    [resummarize],
  );
  const handleRetranscribe = useCallback(
    (id: string) => {
      void retranscribe(id);
    },
    [retranscribe],
  );
  const handleSendToJournal = useCallback(
    async (id: string) => {
      const result = await sendToJournal(id);
      if (result?.journalNoteId) navigate(toNote(result.journalNoteId));
    },
    [navigate, sendToJournal],
  );

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
        <Microphone size={16} className="text-muted-foreground" />
        <h1 className="text-sm font-semibold">Meetings</h1>
        {recordings.length > 0 && (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
            {recordings.length}
          </span>
        )}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={startRecording} className="text-xs">
          <Microphone size={14} />
          New recording
        </Button>
      </header>

      <InlineRecordingPanel />

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[300px] shrink-0 overflow-y-auto border-r border-border bg-background">
          {!loadedOnce && loading && <ListSkeleton />}
          {loadedOnce && recordings.length === 0 && <EmptyState onStart={startRecording} />}
          {recordings.length > 0 && (
            <ul className="p-2">
              {recordings.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => select(r.id)}
                    className={cn(
                      'group w-full rounded-lg px-2.5 py-2 text-left',
                      'transition-[background-color,transform] duration-150 active:scale-[0.99]',
                      selected?.id === r.id
                        ? 'bg-primary/10'
                        : 'hover:bg-muted',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <StatusBadge status={r.status} />
                      <span
                        className={cn(
                          'flex-1 truncate text-sm font-medium',
                          selected?.id === r.id ? 'text-foreground' : 'text-foreground/90',
                        )}
                      >
                        {r.title}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 pl-[22px] text-[11px] text-muted-foreground">
                      <span className="tabular-nums">{formatRelative(r.createdAt)}</span>
                      <span aria-hidden>·</span>
                      <span className="tabular-nums">{formatDuration(r.durationMs)}</span>
                      {r.journalDate && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="inline-flex items-center gap-0.5 text-emerald-600">
                            <Check size={9} weight="bold" />
                            <span>journal</span>
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && (
            <div className="m-3 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}
        </aside>

        <section className="flex-1 overflow-y-auto bg-background">
          {!selected ? (
            <DetailPlaceholder hasAny={recordings.length > 0} />
          ) : (
            <DetailPanel
              recording={selected}
              busy={isBusy(selected.id)}
              onResummarize={() => handleResummarize(selected.id)}
              onRetranscribe={() => handleRetranscribe(selected.id)}
              onSendToJournal={() => handleSendToJournal(selected.id)}
              onDelete={() => void remove(selected.id)}
            />
          )}
        </section>
      </div>
    </div>
  );
}

// =============================================================================
// Detail panel
// =============================================================================

function DetailPanel({
  recording,
  busy,
  onResummarize,
  onRetranscribe,
  onSendToJournal,
  onDelete,
}: {
  recording: MeetingRecording;
  busy: boolean;
  onResummarize: () => void;
  onRetranscribe: () => void;
  onSendToJournal: () => void;
  onDelete: () => void;
}) {
  const playback = useMeetingPlayback(recording.id, recording.durationMs);
  return (
    <div className="mx-auto max-w-3xl px-8 py-7">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-balance text-xl font-semibold leading-tight">{recording.title}</h2>
          <div className="mt-1.5 flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="tabular-nums">{formatAbsolute(recording.createdAt)}</span>
            <Dot />
            <span className="tabular-nums">{formatDuration(recording.durationMs)}</span>
            <Dot />
            <StatusInline status={recording.status} />
            {recording.journalDate && (
              <>
                <Dot />
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <Check size={10} weight="bold" />
                  in journal {recording.journalDate}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onSendToJournal}
          disabled={busy || !recording.summary}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3',
            'text-xs font-medium text-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
            'transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.96]',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <PaperPlaneTilt size={12} weight="fill" />
          Send to journal
        </button>
        <button
          type="button"
          onClick={onResummarize}
          disabled={busy || !recording.transcriptText}
          title="Regenerate the summary (preview — does not touch the journal)"
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3',
            'text-xs font-medium text-foreground transition-[transform,background-color] duration-150',
            'hover:bg-muted active:scale-[0.96]',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <ArrowsClockwise size={12} weight={busy ? 'fill' : 'regular'} className={cn(busy && 'animate-spin')} />
          Re-summarize
        </button>
        {recording.audioPath && (
          <button
            type="button"
            onClick={onRetranscribe}
            disabled={busy}
            title="Re-run transcription on the saved audio (e.g. after a model upgrade)"
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3',
              'text-xs font-medium text-foreground transition-[transform,background-color] duration-150',
              'hover:bg-muted active:scale-[0.96]',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <Waveform size={12} weight={busy ? 'fill' : 'regular'} />
            Re-transcribe
          </button>
        )}
        <div className="flex-1" />
        <DeleteButton onConfirm={onDelete} disabled={busy} />
      </div>

      {playback.available && <AudioPlayer playback={playback} />}

      {recording.status === 'failed' && recording.error && (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <Warning size={14} weight="fill" className="mt-0.5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-destructive">Pipeline failed</div>
            <div className="mt-0.5 text-[12px] leading-relaxed text-destructive/80">
              {recording.error}
            </div>
          </div>
        </div>
      )}

      <SummarySection recording={recording} />
      <TranscriptSection
        recording={recording}
        currentMs={playback.available ? playback.currentMs : null}
        onSeek={playback.available ? playback.seek : undefined}
      />
    </div>
  );
}

// =============================================================================
// Audio player
// =============================================================================

function AudioPlayer({ playback }: { playback: MeetingPlayback }) {
  const { isPlaying, currentMs, durationMs, toggle, seek } = playback;
  const max = durationMs || 1;
  return (
    <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground',
          'shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.94]',
        )}
      >
        {isPlaying ? <Pause size={15} weight="fill" /> : <Play size={15} weight="fill" className="ml-0.5" />}
      </button>
      <span className="w-10 shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {formatClock(currentMs)}
      </span>
      <input
        type="range"
        min={0}
        max={max}
        value={Math.min(currentMs, max)}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="Seek"
        className="h-1 flex-1 cursor-pointer accent-primary"
      />
      <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
        {formatClock(durationMs)}
      </span>
    </div>
  );
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function SummarySection({ recording }: { recording: MeetingRecording }) {
  return (
    <section className="mt-7">
      <SectionLabel>Summary</SectionLabel>
      {recording.summary ? (
        <article
          className="prose prose-sm mt-2 max-w-none rounded-xl border border-border bg-card px-5 py-4 text-[14px] leading-relaxed text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          // Summary is our own AI output rendered with html:false (escaped) — safe.
          dangerouslySetInnerHTML={{ __html: renderMarkdown(recording.summary) }}
        />
      ) : (
        <EmptyLine>No summary yet.</EmptyLine>
      )}
    </section>
  );
}

interface TranscriptTurn {
  source: 'mic' | 'system' | undefined;
  startMs: number;
  text: string;
}

/** Group consecutive same-speaker segments into turns (Granola-style). */
function groupTurns(segments: MeetingRecording['transcriptSegments']): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  for (const seg of segments) {
    const text = seg.text.trim();
    if (!text) continue;
    const last = turns[turns.length - 1];
    if (last && last.source === seg.source) {
      last.text = `${last.text} ${text}`;
    } else {
      turns.push({ source: seg.source, startMs: seg.startMs, text });
    }
  }
  return turns;
}

function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function TranscriptSection({
  recording,
  currentMs,
  onSeek,
}: {
  recording: MeetingRecording;
  /** Playback position for highlighting the active turn; null when no audio. */
  currentMs: number | null;
  /** Seek the player to a turn's start; absent when audio isn't available. */
  onSeek?: (ms: number) => void;
}) {
  // Auto-expand when failed so users can see the transcript that did save
  // even though summarisation didn't — otherwise it looks like nothing
  // was captured.
  const [open, setOpen] = useState(recording.status === 'failed');
  if (!recording.transcriptText) {
    return (
      <section className="mt-6">
        <SectionLabel>Transcript</SectionLabel>
        <EmptyLine>No transcript captured.</EmptyLine>
      </section>
    );
  }

  const turns = groupTurns(recording.transcriptSegments ?? []);
  // The active turn is the last one whose start is at/just before the cursor.
  const activeTurn =
    currentMs === null
      ? -1
      : turns.reduce((active, turn, i) => (turn.startMs <= currentMs ? i : active), -1);

  return (
    <TranscriptBody open={open} setOpen={setOpen} turns={turns} activeTurn={activeTurn} onSeek={onSeek} transcriptText={recording.transcriptText} />
  );
}

function TranscriptBody({
  open,
  setOpen,
  turns,
  activeTurn,
  onSeek,
  transcriptText,
}: {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  turns: TranscriptTurn[];
  activeTurn: number;
  onSeek?: (ms: number) => void;
  transcriptText: string;
}) {
  // Keep the playing turn in view as the cursor advances.
  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeTurn >= 0) {
      activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeTurn]);

  // Plain-text rendering of the whole transcript, speaker-labelled when we
  // have per-turn data, otherwise the raw legacy text.
  const copyText =
    turns.length > 0
      ? turns
          .map((turn) => `${turn.source === 'system' ? 'Others' : 'You'}: ${turn.text}`)
          .join('\n\n')
      : transcriptText;

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <SectionLabel>Transcript</SectionLabel>
        <div className="flex items-center gap-3">
          <CopyButton text={copyText} />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 rounded text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {open ? 'Hide' : 'Show'}
            <CaretDown
              size={10}
              weight="bold"
              className={cn('transition-transform duration-200 ease-out', open && 'rotate-180')}
            />
          </button>
        </div>
      </div>
      {open &&
        (turns.length > 0 ? (
          <div className="mt-3 max-h-[480px] space-y-4 overflow-auto rounded-xl border border-border bg-muted/20 p-4">
            {turns.map((turn, i) => (
              <div
                key={i}
                ref={i === activeTurn ? activeRef : undefined}
                className={cn(
                  '-mx-1.5 flex scroll-mt-2 gap-3 rounded-lg px-1.5 py-1 transition-colors',
                  i === activeTurn && 'bg-primary/10',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSeek?.(turn.startMs)}
                  disabled={!onSeek}
                  title={onSeek ? 'Play from here' : undefined}
                  className={cn(
                    'w-9 shrink-0 pt-[3px] text-left text-[11px] tabular-nums text-muted-foreground/70',
                    onSeek && 'cursor-pointer hover:text-primary hover:underline',
                  )}
                >
                  {formatTimestamp(turn.startMs)}
                </button>
                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-wider',
                      turn.source === 'system' ? 'text-teal-600' : 'text-emerald-600',
                    )}
                  >
                    {turn.source === 'system' ? 'Others' : 'You'}
                  </span>
                  <p className="mt-0.5 text-pretty text-[13px] leading-relaxed text-foreground/85">
                    {turn.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Legacy single-track transcript without per-segment data.
          <pre
            className={cn(
              'mt-2 max-h-[480px] overflow-auto whitespace-pre-wrap rounded-xl',
              'border border-border bg-muted/30 p-4 font-mono text-[12px] leading-relaxed text-foreground/80',
            )}
          >
            {transcriptText}
          </pre>
        ))}
    </section>
  );
}

// =============================================================================
// Copy-to-clipboard button (transcript)
// =============================================================================

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — nothing useful to do here.
    }
  };
  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      disabled={!text}
      aria-label="Copy transcript"
      title="Copy entire transcript"
      className={cn(
        'inline-flex items-center gap-1 rounded text-[11px] font-medium transition-colors',
        copied ? 'text-emerald-600' : 'text-muted-foreground hover:text-foreground',
        'disabled:cursor-not-allowed disabled:opacity-40',
      )}
    >
      {copied ? <Check size={11} weight="bold" /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// =============================================================================
// Inline delete with confirm-on-second-click
// =============================================================================

function DeleteButton({ onConfirm, disabled }: { onConfirm: () => void; disabled: boolean }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        if (armed) {
          onConfirm();
          setArmed(false);
        } else {
          setArmed(true);
          window.setTimeout(() => setArmed(false), 3000);
        }
      }}
      disabled={disabled}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3',
        'text-xs font-medium transition-[transform,background-color,border-color,color] duration-150',
        'active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50',
        armed
          ? 'border-destructive bg-destructive text-destructive-foreground hover:opacity-90'
          : 'border-border bg-background text-destructive hover:bg-destructive/10',
      )}
    >
      <Trash size={12} weight={armed ? 'fill' : 'regular'} />
      {armed ? 'Confirm delete' : 'Delete'}
    </button>
  );
}

// =============================================================================
// Status badge — small filled pill for the list, inline text for detail
// =============================================================================

function StatusBadge({ status }: { status: MeetingRecordingStatus }) {
  if (status === 'ready') {
    return (
      <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
        <Check size={8} weight="bold" />
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="flex size-4 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <Warning size={8} weight="fill" />
      </span>
    );
  }
  if (status === 'recording' || status === 'transcribing' || status === 'summarizing') {
    return (
      <span className="flex size-4 items-center justify-center rounded-full bg-primary/15 text-primary">
        <CircleNotch size={10} className="animate-spin" />
      </span>
    );
  }
  return <span className="size-4 rounded-full bg-muted" />;
}

const STATUS_TONE: Record<MeetingRecordingStatus, string> = {
  recording: 'text-primary',
  transcribing: 'text-primary',
  summarizing: 'text-primary',
  ready: 'text-emerald-600',
  failed: 'text-destructive',
};

const STATUS_LABEL: Record<MeetingRecordingStatus, string> = {
  recording: 'recording',
  transcribing: 'transcribing',
  summarizing: 'summarising',
  ready: 'ready',
  failed: 'failed',
};

function StatusInline({ status }: { status: MeetingRecordingStatus }) {
  return <span className={STATUS_TONE[status]}>{STATUS_LABEL[status]}</span>;
}

// =============================================================================
// Helpers
// =============================================================================

function Dot() {
  return <span className="text-muted-foreground/40">·</span>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-[13px] italic text-muted-foreground/70">{children}</p>;
}

function DetailPlaceholder({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center text-muted-foreground">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground/60">
        <Microphone size={24} />
      </div>
      <p className="mt-4 text-balance text-sm">
        {hasAny
          ? 'Select a recording to view its transcript and summary.'
          : 'Recordings you make will appear here.'}
      </p>
    </div>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="px-6 py-10 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Microphone size={20} weight="fill" />
      </div>
      <p className="mt-4 text-sm font-medium">No meetings yet</p>
      <p className="mt-1 text-pretty text-[12px] leading-relaxed text-muted-foreground">
        Record a session: Stone transcribes locally and summarises into your journal.
      </p>
      <button
        type="button"
        onClick={onStart}
        className={cn(
          'mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2',
          'text-xs font-medium text-primary-foreground',
          'transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.96]',
        )}
      >
        <Microphone size={12} weight="fill" />
        Start recording
      </button>
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="p-2">
      {[0, 1, 2].map((i) => (
        <li key={i} className="rounded-lg p-2.5">
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-2 w-20 animate-pulse rounded bg-muted/60" />
        </li>
      ))}
    </ul>
  );
}

// =============================================================================
// Date / duration formatting
// =============================================================================

function formatRelative(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatAbsolute(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return mm > 0 ? `${mm}m ${ss}s` : `${ss}s`;
}
