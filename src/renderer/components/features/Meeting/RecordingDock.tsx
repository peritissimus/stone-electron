/**
 * RecordingDock — floating dock that shows the active recording session.
 *
 * Mounted once at the layout root. Visibility comes from the
 * meetingRecorderStore.dock flag; opening it without a session shows
 * a "Start recording" CTA.
 */

import { useEffect } from 'react';
import { Microphone, Stop, X, CircleNotch, Check, Warning } from 'phosphor-react';
import { useMeetingRecorder, type RecorderPhase } from '@renderer/hooks/useMeetingRecorder';

export function RecordingDock() {
  const {
    phase,
    dock,
    elapsedMs,
    error,
    lastRecording,
    start,
    stop,
    cancel,
    closeDock,
    reset,
  } = useMeetingRecorder();

  // Auto-close the dock a few seconds after a successful session so the
  // user isn't stuck dismissing the success state.
  useEffect(() => {
    if (phase !== 'done') return;
    const id = window.setTimeout(() => {
      reset();
    }, 6000);
    return () => window.clearTimeout(id);
  }, [phase, reset]);

  if (!dock) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[320px] rounded-xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur">
      <header className="flex items-center gap-2">
        <Microphone size={16} className="text-primary" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Meeting recorder
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => {
            if (phase === 'recording') void cancel();
            else closeDock();
          }}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close recorder"
        >
          <X size={14} />
        </button>
      </header>

      <Body phase={phase} elapsedMs={elapsedMs} error={error} lastTitle={lastRecording?.title ?? null} />

      <footer className="mt-3 flex items-center gap-2">
        {(phase === 'idle' || phase === 'done' || phase === 'error') && (
          <button
            type="button"
            onClick={() => void start()}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.96]"
          >
            <Microphone size={14} weight="fill" />
            {phase === 'done' ? 'Record another' : 'Start recording'}
          </button>
        )}
        {phase === 'preparing' && (
          <button
            type="button"
            disabled
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground"
          >
            <CircleNotch size={14} className="animate-spin" />
            Preparing…
          </button>
        )}
        {phase === 'recording' && (
          <button
            type="button"
            onClick={() => void stop()}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90 active:scale-[0.96]"
          >
            <Stop size={14} weight="fill" />
            Stop and process
          </button>
        )}
        {(phase === 'uploading' || phase === 'finalizing') && (
          <button
            type="button"
            disabled
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground"
          >
            <CircleNotch size={14} className="animate-spin" />
            {phase === 'uploading' ? 'Uploading…' : 'Transcribing…'}
          </button>
        )}
      </footer>
    </div>
  );
}

function Body({
  phase,
  elapsedMs,
  error,
  lastTitle,
}: {
  phase: RecorderPhase;
  elapsedMs: number;
  error: string | null;
  lastTitle: string | null;
}) {
  if (phase === 'recording') {
    return (
      <div className="mt-3 flex items-center gap-3">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-destructive" />
        <span className="font-mono text-xl tabular-nums">{formatElapsed(elapsedMs)}</span>
        <span className="text-xs text-muted-foreground">recording</span>
      </div>
    );
  }
  if (phase === 'done') {
    return (
      <div className="mt-3 flex items-start gap-2 text-sm">
        <Check size={14} className="mt-0.5 text-emerald-500" />
        <div className="flex-1">
          <div className="font-medium">Summary added to Meetings</div>
          {lastTitle && <div className="text-xs text-muted-foreground">{lastTitle}</div>}
        </div>
      </div>
    );
  }
  if (phase === 'error') {
    return (
      <div className="mt-3 flex items-start gap-2 text-sm">
        <Warning size={14} className="mt-0.5 text-destructive" />
        <div className="flex-1 text-xs text-destructive">{error ?? 'Recording failed'}</div>
      </div>
    );
  }
  if (phase === 'uploading' || phase === 'finalizing') {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        Processing the audio locally — Whisper transcribes and your configured model summarises.
      </p>
    );
  }
  return (
    <p className="mt-3 text-xs text-muted-foreground">
      Captures from your default microphone. Audio stays under{' '}
      <code className="rounded bg-muted px-1">.stone/recordings</code> until processing finishes,
      then it's deleted.
    </p>
  );
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  if (hh > 0) {
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
