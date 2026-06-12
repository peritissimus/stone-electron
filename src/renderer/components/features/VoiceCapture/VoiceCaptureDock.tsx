/**
 * VoiceCaptureDock — compact floating pill for the "speak → journal" flow.
 *
 * Mounted once in MainLayout's overlay; owns the recorder hardware via
 * useVoiceCapture. Other surfaces open it through useVoiceCaptureTrigger,
 * and opening auto-starts the recording — the gesture is: tap, talk, stop.
 */

import { useEffect, useRef } from 'react';
import { ArrowCounterClockwise, CircleNotch, Microphone, Stop, Warning, X } from '@phosphor-icons/react';
import { cn } from '@renderer/lib/utils';
import { useVoiceCapture } from '@renderer/hooks/useVoiceCapture';

export function VoiceCaptureDock() {
  const { open, phase, elapsedMs, audioLevel, error, start, stop, cancel } = useVoiceCapture();

  // Opening the dock starts recording immediately — one gesture, no
  // second click. Guarded so re-renders don't re-trigger.
  const startedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    void start();
  }, [open, start]);

  // Esc cancels, Enter stops-and-saves, while the dock is up.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
      if (e.key === 'Enter' && phase === 'recording') {
        e.preventDefault();
        void stop();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, phase, stop, cancel]);

  if (!open) return null;

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 z-50 -translate-x-1/2',
        'flex items-center gap-3 rounded-2xl border border-border bg-card/95 py-2 pl-3 pr-2 backdrop-blur-md',
        'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.12)]',
        'animate-in fade-in slide-in-from-bottom-2',
      )}
      style={{ animationDuration: '200ms' }}
      role="status"
      aria-label="Voice capture"
    >
      {phase === 'recording' && (
        <>
          <span className="relative flex size-2.5 shrink-0" aria-hidden>
            <span className="absolute inset-0 animate-ping rounded-full bg-destructive opacity-60" />
            <span className="relative inline-block size-2.5 rounded-full bg-destructive" />
          </span>
          <span className="font-mono text-sm font-medium tabular-nums text-foreground">
            {formatElapsed(elapsedMs)}
          </span>
          <MiniMeter level={audioLevel} />
          <button
            type="button"
            onClick={() => void stop()}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground',
              'shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-[transform,opacity] duration-150',
              'hover:opacity-90 active:scale-[0.96]',
            )}
            title="Stop and save to journal (Enter)"
          >
            <Stop size={12} weight="fill" />
            Save
          </button>
        </>
      )}

      {phase === 'idle' && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Microphone size={14} />
          Asking for microphone…
        </div>
      )}

      {phase === 'transcribing' && (
        <div className="flex items-center gap-2 pr-1 text-xs text-foreground">
          <CircleNotch size={14} className="animate-spin text-primary" />
          <span className="font-medium">Transcribing…</span>
          <span className="text-muted-foreground">saves to today's journal</span>
        </div>
      )}

      {phase === 'error' && (
        <>
          <div className="flex max-w-[320px] items-center gap-2 text-xs text-destructive">
            <Warning size={14} weight="fill" className="shrink-0" />
            <span className="truncate" title={error ?? undefined}>
              {error ?? 'Voice capture failed'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void start()}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground',
              'transition-[transform,background-color] duration-150 hover:bg-muted active:scale-[0.96]',
            )}
          >
            <ArrowCounterClockwise size={12} />
            Retry
          </button>
        </>
      )}

      {phase !== 'transcribing' && (
        <button
          type="button"
          onClick={cancel}
          className={cn(
            'relative flex size-7 items-center justify-center rounded-lg text-muted-foreground',
            'transition-[transform,background-color,color] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96]',
            // Extend hit area to ~40×40 without changing visible size.
            "before:absolute before:inset-[-7px] before:content-['']",
          )}
          aria-label="Cancel voice capture"
          title="Cancel (Esc)"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

// Compact 12-bar level meter — same envelope idea as the meeting dock's,
// sized for a pill.
const BAR_COUNT = 12;

function MiniMeter({ level }: { level: number }) {
  return (
    <div className="flex h-5 w-16 items-end gap-[2px]" aria-hidden>
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const center = (BAR_COUNT - 1) / 2;
        const distance = Math.abs(i - center) / center;
        const envelope = 1 - distance * 0.55;
        const heightFraction = Math.max(0.12, Math.min(1, level * envelope * 1.35));
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

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
