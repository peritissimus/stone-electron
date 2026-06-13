/**
 * InlineRecordingPanel — the recorder, presented inline on the Meetings page.
 *
 * When a recording is started from (or while on) the Meetings page, the
 * floating dock is suppressed and the live state shows here instead: a calm,
 * spacious Granola-style panel with a large timer and full-width waveforms.
 * Self-hides when the recorder is idle and the dock is closed.
 */

import { Microphone, Stop, CircleNotch, Check, Warning, GearSix } from '@phosphor-icons/react';
import { cn } from '@renderer/lib/utils';
import { useMeetingRecorder } from '@renderer/hooks/useMeetingRecorder';
import { useSystemAudioPermission } from '@renderer/hooks/useOnboarding';
import { isMacOS } from '@renderer/hooks/useKeyboardShortcuts';
import { WaveRow, InactiveWaveRow } from './RecordingWaveform';

export function InlineRecordingPanel() {
  const {
    phase,
    dock,
    elapsedMs,
    audioLevel,
    systemAudioLevel,
    captureMode,
    error,
    lastRecording,
    start,
    stop,
    cancel,
  } = useMeetingRecorder();
  const systemAudio = useSystemAudioPermission();

  // Idle + closed → nothing to show; the page header owns "New recording".
  if (phase === 'idle' && !dock) return null;

  return (
    <div
      className={cn(
        'mx-4 mt-3 overflow-hidden rounded-2xl border border-border bg-card',
        'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]',
        'animate-in fade-in slide-in-from-top-1 duration-300',
      )}
    >
      {phase === 'recording' ? (
        <ActiveRecording
          elapsedMs={elapsedMs}
          audioLevel={audioLevel}
          systemAudioLevel={systemAudioLevel}
          captureMode={captureMode}
          onStop={() => void stop()}
          onCancel={() => void cancel()}
        />
      ) : phase === 'preparing' ? (
        <Status icon={<CircleNotch size={18} className="animate-spin text-primary" />} title="Preparing…" detail="Reserving slot and asking for the microphone." />
      ) : phase === 'uploading' ? (
        <Status icon={<CircleNotch size={18} className="animate-spin text-primary" />} title="Saving audio" detail="Storing the recording locally." />
      ) : phase === 'finalizing' ? (
        <Status icon={<CircleNotch size={18} className="animate-spin text-primary" />} title="Transcribing & summarising" detail="Runs on this device. First time downloads Whisper (~80 MB)." />
      ) : phase === 'done' ? (
        <Status
          icon={
            <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
              <Check size={13} weight="bold" />
            </span>
          }
          title="Added to Meetings"
          detail={lastRecording?.title ?? undefined}
          tone="success"
        />
      ) : phase === 'error' ? (
        <Status
          icon={
            <span className="flex size-6 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <Warning size={13} weight="fill" />
            </span>
          }
          title="Recording failed"
          detail={error ?? undefined}
          tone="error"
        />
      ) : (
        <IdleStart
          onStart={() => void start()}
          systemAudioStatus={systemAudio.status}
          onEnableSystemAudio={systemAudio.openSettings}
        />
      )}
    </div>
  );
}

// =============================================================================

function ActiveRecording({
  elapsedMs,
  audioLevel,
  systemAudioLevel,
  captureMode,
  onStop,
  onCancel,
}: {
  elapsedMs: number;
  audioLevel: number;
  systemAudioLevel: number;
  captureMode: 'mic-only' | 'mic+system';
  onStop: () => void;
  onCancel: () => void;
}) {
  const dual = captureMode === 'mic+system';
  return (
    <div className="p-5">
      <div className="flex items-center gap-4">
        <span className="relative flex size-3 shrink-0">
          <span className="absolute inset-0 animate-ping rounded-full bg-destructive opacity-60" />
          <span className="relative inline-block size-3 rounded-full bg-destructive" />
        </span>
        <span className="font-mono text-[34px] font-semibold leading-none tabular-nums text-foreground">
          {formatElapsed(elapsedMs)}
        </span>
        <span
          className={cn(
            'rounded-md px-2 py-0.5 text-[11px] font-medium',
            dual ? 'bg-teal-500/15 text-teal-600' : 'bg-muted text-muted-foreground',
          )}
          title={
            dual
              ? 'Capturing your microphone plus system audio (other participants).'
              : 'Capturing your microphone only.'
          }
        >
          {dual ? 'mic + system' : 'mic only'}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            'h-9 rounded-lg px-3 text-sm font-medium text-muted-foreground',
            'transition-[transform,background-color,color] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96]',
          )}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onStop}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-lg bg-destructive px-4 text-sm font-medium text-destructive-foreground',
            'shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.96]',
          )}
        >
          <Stop size={14} weight="fill" />
          Stop & process
        </button>
      </div>

      <div className="mt-4 space-y-2.5">
        <WaveRow label="You" level={audioLevel} tone="mic" size="lg" />
        {dual ? (
          <WaveRow label="Others" level={systemAudioLevel} tone="system" size="lg" />
        ) : (
          <InactiveWaveRow label="Others" hint="System audio off" size="lg" />
        )}
      </div>
    </div>
  );
}

function IdleStart({
  onStart,
  systemAudioStatus,
  onEnableSystemAudio,
}: {
  onStart: () => void;
  systemAudioStatus: 'granted' | 'denied' | 'unsupported' | null;
  onEnableSystemAudio: () => void;
}) {
  const needsSystemAudio = isMacOS() && systemAudioStatus === 'denied';
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Microphone size={22} weight="fill" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">Record this meeting</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {isMacOS() && systemAudioStatus !== 'granted'
            ? 'Your mic, transcribed on this device.'
            : 'Mic + system audio, transcribed on this device.'}{' '}
          Audio is deleted after.
        </p>
      </div>
      <button
        type="button"
        onClick={onStart}
        className={cn(
          'inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground',
          'shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.96]',
        )}
      >
        <Microphone size={15} weight="fill" />
        Start recording
      </button>
      {needsSystemAudio && (
        <button
          type="button"
          onClick={onEnableSystemAudio}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          title="Capture other participants. Opens System Settings → Screen Recording."
        >
          <GearSix size={12} />
          Enable system audio to capture others
        </button>
      )}
    </div>
  );
}

function Status({
  icon,
  title,
  detail,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  title: string;
  detail?: string;
  tone?: 'neutral' | 'success' | 'error';
}) {
  return (
    <div className="flex items-center gap-3 p-5">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p
          className={cn(
            'text-sm font-medium text-balance',
            tone === 'error' ? 'text-destructive' : 'text-foreground',
          )}
        >
          {title}
        </p>
        {detail && <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hh > 0 ? `${pad(hh)}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
}
