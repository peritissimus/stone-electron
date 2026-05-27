/**
 * MeetingsPage — management surface for past meeting recordings.
 *
 * Two-column layout: a list on the left (newest first) and a detail
 * panel on the right showing the transcript + current summary, with
 * Re-summarize (preview only) and Send-to-journal (always appends fresh)
 * actions. Delete drops the DB row and any orphan audio.
 *
 * Per the agreed UX, Re-summarize does NOT touch the journal — only
 * Send-to-journal does.
 */

import { useCallback } from 'react';
import {
  Microphone,
  CaretRight,
  ArrowsClockwise,
  PaperPlaneTilt,
  Trash,
  Warning,
  Check,
  CircleNotch,
} from 'phosphor-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@renderer/lib/utils';
import { IconButton, sizeHeightClasses } from '@renderer/components/composites';
import { useSidebarUI } from '@renderer/hooks/useUI';
import { useMeetings } from '@renderer/hooks/useMeetings';
import { useMeetingRecorder } from '@renderer/hooks/useMeetingRecorder';
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
    sendToJournal,
    remove,
    isBusy,
  } = useMeetings();
  const { openDock } = useMeetingRecorder();

  const handleResummarize = useCallback(
    (id: string) => {
      void resummarize(id);
    },
    [resummarize],
  );
  const handleSendToJournal = useCallback(
    async (id: string) => {
      const result = await sendToJournal(id);
      if (result?.journalNoteId) {
        navigate(toNote(result.journalNoteId));
      }
    },
    [navigate, sendToJournal],
  );
  const handleDelete = useCallback(
    (id: string) => {
      if (!window.confirm('Delete this recording? The transcript and summary will be lost.')) {
        return;
      }
      void remove(id);
    },
    [remove],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header
        className={cn(
          'px-4 border-b border-border shrink-0 bg-card flex items-center gap-3',
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
        <span className="text-sm font-medium">Meetings</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={openDock}
          className="inline-flex h-8 items-center gap-2 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.96]"
        >
          <Microphone size={14} weight="fill" />
          New recording
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 border-r border-border overflow-y-auto">
          {!loadedOnce && loading && <ListSkeleton />}
          {loadedOnce && recordings.length === 0 && (
            <EmptyState onStart={openDock} />
          )}
          {recordings.length > 0 && (
            <ul className="divide-y divide-border">
              {recordings.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => select(r.id)}
                    className={cn(
                      'w-full px-3 py-3 text-left transition-colors',
                      selected?.id === r.id
                        ? 'bg-primary/10'
                        : 'hover:bg-muted',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <StatusDot status={r.status} />
                      <span className="text-sm font-medium truncate flex-1">{r.title}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(r.createdAt)}</span>
                      <span>·</span>
                      <span>{formatDuration(r.durationMs)}</span>
                      {r.journalDate && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-600">in journal</span>
                        </>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && (
            <div className="m-3 rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </aside>

        <section className="flex-1 overflow-y-auto">
          {!selected ? (
            <DetailPlaceholder hasAny={recordings.length > 0} />
          ) : (
            <DetailPanel
              recording={selected}
              busy={isBusy(selected.id)}
              onResummarize={() => handleResummarize(selected.id)}
              onSendToJournal={() => handleSendToJournal(selected.id)}
              onDelete={() => handleDelete(selected.id)}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function DetailPanel({
  recording,
  busy,
  onResummarize,
  onSendToJournal,
  onDelete,
}: {
  recording: MeetingRecording;
  busy: boolean;
  onResummarize: () => void;
  onSendToJournal: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="px-6 py-5 max-w-3xl mx-auto">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-balance">{recording.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDate(recording.createdAt)} · {formatDuration(recording.durationMs)} ·{' '}
            <StatusText status={recording.status} />
            {recording.journalDate && <> · sent to journal {recording.journalDate}</>}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onResummarize}
            disabled={busy || !recording.transcriptText}
            title="Regenerate the summary (preview — does not touch the journal)"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs transition-colors hover:bg-muted disabled:opacity-50"
          >
            <ArrowsClockwise size={12} />
            Re-summarize
          </button>
          <button
            type="button"
            onClick={onSendToJournal}
            disabled={busy || !recording.summary}
            title="Append this summary to today's journal as a new entry"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <PaperPlaneTilt size={12} />
            Send to journal
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            title="Delete this recording permanently"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
          >
            <Trash size={12} />
            Delete
          </button>
        </div>
      </div>

      {recording.status === 'failed' && recording.error && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <Warning size={14} className="mt-0.5 text-destructive" />
          <div>
            <div className="font-medium text-destructive">Pipeline failed</div>
            <div className="text-xs text-destructive/80">{recording.error}</div>
          </div>
        </div>
      )}

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</h2>
        {recording.summary ? (
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed">
            {recording.summary}
          </pre>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No summary yet.</p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transcript</h2>
        {recording.transcriptText ? (
          <pre className="mt-2 max-h-[480px] overflow-auto whitespace-pre-wrap rounded border border-border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
            {recording.transcriptText}
          </pre>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No transcript captured.</p>
        )}
      </section>
    </div>
  );
}

function DetailPlaceholder({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      <Microphone size={48} className="text-muted-foreground/30 mb-4" />
      {hasAny ? (
        <p className="text-sm">Select a recording to view its transcript and summary.</p>
      ) : (
        <p className="text-sm">Recordings you make will appear here.</p>
      )}
    </div>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="p-6 text-center">
      <Microphone size={32} className="mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm font-medium">No meetings yet</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Record a session — Stone transcribes locally and summarises into your journal.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Microphone size={12} weight="fill" />
        Start recording
      </button>
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="divide-y divide-border">
      {[0, 1, 2].map((i) => (
        <li key={i} className="px-3 py-3">
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-2 w-20 animate-pulse rounded bg-muted/70" />
        </li>
      ))}
    </ul>
  );
}

function StatusDot({ status }: { status: MeetingRecordingStatus }) {
  if (status === 'ready') {
    return <Check size={12} className="text-emerald-500" />;
  }
  if (status === 'failed') {
    return <Warning size={12} className="text-destructive" />;
  }
  if (status === 'recording' || status === 'transcribing' || status === 'summarizing') {
    return <CircleNotch size={12} className="animate-spin text-primary" />;
  }
  return <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" />;
}

function StatusText({ status }: { status: MeetingRecordingStatus }) {
  const label: Record<MeetingRecordingStatus, string> = {
    recording: 'recording',
    transcribing: 'transcribing',
    summarizing: 'summarising',
    ready: 'ready',
    failed: 'failed',
  };
  return <span>{label[status]}</span>;
}

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString(undefined, {
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
