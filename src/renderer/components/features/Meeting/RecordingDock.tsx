/**
 * RecordingDock — floating dock for the active recording session.
 *
 * Concentric radii (rounded-3xl outer with p-3 → rounded-xl inner,
 * theme tokens throughout, scale-on-press, smooth phase crossfade,
 * and a live audio level meter so the recording state feels alive.
 */

import { useEffect } from 'react';
import { Microphone, Stop, X, CircleNotch, Check, Warning } from '@phosphor-icons/react';
import { cn } from '@renderer/lib/utils';
import { useMeetingRecorder, type RecorderPhase } from '@renderer/hooks/useMeetingRecorder';
import { subscribe } from '@renderer/lib/events';
import { EVENTS } from '@shared/constants/ipcChannels';

export function RecordingDock() {
  const {
    phase,
    dock,
    elapsedMs,
    audioLevel,
    captureMode,
    error,
    lastRecording,
    start,
    stop,
    cancel,
    openDock,
    closeDock,
    reset,
  } = useMeetingRecorder();

  // Auto-dismiss the success state so the dock isn't stuck on-screen.
  useEffect(() => {
    if (phase !== 'done') return;
    const id = window.setTimeout(reset, 6000);
    return () => window.clearTimeout(id);
  }, [phase, reset]);

  // Cross-window trigger: Quick Capture (and other surfaces later) can
  // ask the main window to open the dock via this event.
  useEffect(() => {
    return subscribe(EVENTS.MEETING_OPEN_DOCK_REQUESTED, () => openDock());
  }, [openDock]);

  // Tray menu / global shortcut: open dock AND auto-start a recording
  // in one step. We don't auto-start if a session is already in flight
  // — let the user finish or cancel first.
  useEffect(() => {
    return subscribe(EVENTS.MEETING_START_REQUESTED, () => {
      openDock();
      if (phase === 'idle' || phase === 'done' || phase === 'error') {
        void start();
      }
    });
  }, [openDock, start, phase]);

  // Tray "Stop and process" while a recording is active.
  useEffect(() => {
    return subscribe(EVENTS.MEETING_STOP_REQUESTED, () => {
      if (phase === 'recording') void stop();
    });
  }, [stop, phase]);

  if (!dock) return null;

  const isActive = phase === 'recording';
  const isProcessing = phase === 'uploading' || phase === 'finalizing' || phase === 'preparing';

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 w-[340px] overflow-hidden rounded-3xl',
        'border border-border bg-card/95 p-3 backdrop-blur-md',
        'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.12)]',
        'transition-[transform,opacity] duration-200 ease-out',
        'animate-in fade-in slide-in-from-bottom-2',
      )}
    >
      <header className="flex items-center gap-2 px-1">
        <div className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Microphone size={12} weight="fill" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Meeting recorder
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => (phase === 'recording' ? void cancel() : closeDock())}
          className={cn(
            'relative flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground',
            'hover:bg-muted hover:text-foreground active:scale-[0.96]',
            'transition-[transform,background-color,color] duration-150',
            // Extend hit area to 40×40 without changing visible size.
            "before:absolute before:inset-[-6px] before:content-['']",
          )}
          aria-label="Close recorder"
        >
          <X size={14} />
        </button>
      </header>

      <PhaseBody
        phase={phase}
        elapsedMs={elapsedMs}
        audioLevel={audioLevel}
        captureMode={captureMode}
        error={error}
        lastTitle={lastRecording?.title ?? null}
      />

      <footer className="mt-3 flex items-center gap-2 px-1">
        {(phase === 'idle' || phase === 'done' || phase === 'error') && (
          <PrimaryButton onClick={() => void start()} icon={<Microphone size={14} weight="fill" />}>
            {phase === 'done' ? 'Record another' : 'Start recording'}
          </PrimaryButton>
        )}
        {phase === 'preparing' && (
          <DisabledButton icon={<CircleNotch size={14} className="animate-spin" />}>
            Preparing…
          </DisabledButton>
        )}
        {isActive && (
          <button
            type="button"
            onClick={() => void stop()}
            className={cn(
              'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl',
              'bg-destructive text-sm font-medium text-destructive-foreground',
              'shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-[transform,opacity] duration-150',
              'hover:opacity-90 active:scale-[0.96]',
            )}
          >
            <Stop size={14} weight="fill" />
            Stop and process
          </button>
        )}
        {(phase === 'uploading' || phase === 'finalizing') && (
          <DisabledButton icon={<CircleNotch size={14} className="animate-spin" />}>
            {phase === 'uploading' ? 'Saving audio…' : 'Transcribing…'}
          </DisabledButton>
        )}
      </footer>

      {isProcessing && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden">
          <div className="h-full w-1/3 animate-[indeterminate_1.6s_ease-in-out_infinite] bg-primary/70" />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Phase body — crossfaded between states
// =============================================================================

function PhaseBody({
  phase,
  elapsedMs,
  audioLevel,
  captureMode,
  error,
  lastTitle,
}: {
  phase: RecorderPhase;
  elapsedMs: number;
  audioLevel: number;
  captureMode: 'mic-only' | 'mic+system';
  error: string | null;
  lastTitle: string | null;
}) {
  return (
    <div className="relative mt-3 min-h-[68px] rounded-xl bg-muted/40 p-3">
      <Idle visible={phase === 'idle'} />
      <Preparing visible={phase === 'preparing'} />
      <Recording
        visible={phase === 'recording'}
        elapsedMs={elapsedMs}
        audioLevel={audioLevel}
        captureMode={captureMode}
      />
      <Processing
        visible={phase === 'uploading' || phase === 'finalizing'}
        label={phase === 'uploading' ? 'Saving audio locally' : 'Transcribing and summarising'}
      />
      <Done visible={phase === 'done'} title={lastTitle} />
      <Errored visible={phase === 'error'} message={error} />
    </div>
  );
}

const layerCn = (visible: boolean) =>
  cn(
    'absolute inset-0 flex flex-col justify-center px-3 transition-[opacity,transform] duration-200 ease-out',
    visible ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-1',
  );

function Idle({ visible }: { visible: boolean }) {
  return (
    <div className={layerCn(visible)}>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Captures your microphone plus system audio (remote meeting voices). macOS will ask
        for Screen Recording permission the first time so it can read the loopback stream.
        Audio stays under{' '}
        <code className="rounded bg-background px-1 py-px font-mono text-[10px]">
          .stone/recordings
        </code>{' '}
        until processing finishes, then it's deleted.
      </p>
    </div>
  );
}

function Preparing({ visible }: { visible: boolean }) {
  return (
    <div className={layerCn(visible)}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CircleNotch size={12} className="animate-spin" />
        Reserving slot and asking for microphone…
      </div>
    </div>
  );
}

function Recording({
  visible,
  elapsedMs,
  audioLevel,
  captureMode,
}: {
  visible: boolean;
  elapsedMs: number;
  audioLevel: number;
  captureMode: 'mic-only' | 'mic+system';
}) {
  return (
    <div className={layerCn(visible)}>
      <div className="flex items-center gap-3">
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inset-0 animate-ping rounded-full bg-destructive opacity-60" />
          <span className="relative inline-block size-2.5 rounded-full bg-destructive" />
        </span>
        <span className="font-mono text-[22px] font-medium tabular-nums leading-none text-foreground">
          {formatElapsed(elapsedMs)}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-destructive">
          Recording
        </span>
        <span
          className={cn(
            'ml-auto rounded-md px-1.5 py-px text-[10px] font-medium',
            captureMode === 'mic+system'
              ? 'bg-emerald-500/15 text-emerald-600'
              : 'bg-muted text-muted-foreground',
          )}
          title={
            captureMode === 'mic+system'
              ? 'Capturing your microphone plus system audio (other meeting participants).'
              : 'Capturing your microphone only. System audio was unavailable or denied.'
          }
        >
          {captureMode === 'mic+system' ? 'mic + system' : 'mic only'}
        </span>
      </div>
      <LevelMeter level={audioLevel} />
    </div>
  );
}

function Processing({ visible, label }: { visible: boolean; label: string }) {
  return (
    <div className={layerCn(visible)}>
      <div className="flex items-center gap-2 text-sm text-foreground">
        <CircleNotch size={14} className="animate-spin text-primary" />
        <span className="font-medium">{label}</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        First run downloads Whisper-base (~80 MB).
      </p>
    </div>
  );
}

function Done({ visible, title }: { visible: boolean; title: string | null }) {
  return (
    <div className={layerCn(visible)}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
          <Check size={12} weight="bold" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground text-balance">
            Added to Meetings
          </div>
          {title && (
            <div className="truncate text-[11px] text-muted-foreground">{title}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Errored({ visible, message }: { visible: boolean; message: string | null }) {
  return (
    <div className={layerCn(visible)}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex size-5 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <Warning size={12} weight="fill" />
        </div>
        <div className="flex-1 text-[12px] leading-relaxed text-destructive">
          {message ?? 'Recording failed'}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Live audio level meter — 24 bars, peak hold smoothing
// =============================================================================

const BAR_COUNT = 24;

function LevelMeter({ level }: { level: number }) {
  // Stagger bar heights so the meter feels organic — center bars get more
  // amplitude than edges (typical "EQ" envelope).
  return (
    <div className="mt-3 flex h-7 items-end gap-[2px]" aria-hidden>
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const center = (BAR_COUNT - 1) / 2;
        const distance = Math.abs(i - center) / center; // 0 center → 1 edge
        const envelope = 1 - distance * 0.55;
        const heightFraction = Math.max(0.08, Math.min(1, level * envelope * 1.35));
        return (
          <span
            key={i}
            className="flex-1 rounded-sm bg-primary/80 transition-[height] duration-75 ease-out"
            style={{ height: `${heightFraction * 100}%` }}
          />
        );
      })}
    </div>
  );
}

// =============================================================================
// Button primitives
// =============================================================================

function PrimaryButton({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl',
        'bg-primary text-sm font-medium text-primary-foreground',
        'shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-[transform,opacity] duration-150',
        'hover:opacity-90 active:scale-[0.96]',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function DisabledButton({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled
      className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm text-muted-foreground"
    >
      {icon}
      {children}
    </button>
  );
}

// =============================================================================

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  if (hh > 0) {
    return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  }
  return `${pad(mm)}:${pad(ss)}`;
}
function pad(n: number): string {
  return String(n).padStart(2, '0');
}
