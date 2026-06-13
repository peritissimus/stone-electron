/**
 * RecordingWaveform — live scrolling waveform for one capture source.
 *
 * Each row keeps a rolling history of peak levels that scrolls right-to-left
 * (newest sample on the right). Mic is green ("You"), system audio is teal
 * ("Others"). Shared by the floating dock and the inline Meetings panel.
 */

import { useEffect, useReducer, useRef } from 'react';
import { cn } from '@renderer/lib/utils';

const WAVE_BARS = 40;

export function WaveRow({
  label,
  level,
  tone,
  size = 'sm',
}: {
  label: string;
  level: number;
  tone: 'mic' | 'system';
  size?: 'sm' | 'lg';
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          'shrink-0 font-semibold uppercase tracking-wider',
          size === 'lg' ? 'w-12 text-[10px]' : 'w-9 text-[9px]',
          tone === 'mic' ? 'text-emerald-600' : 'text-teal-500',
        )}
      >
        {label}
      </span>
      <Waveform level={level} tone={tone} size={size} />
    </div>
  );
}

/**
 * Inactive counterpart to WaveRow — a dimmed flat line with a reason, shown for
 * a source that isn't being captured (e.g. system audio without permission) so
 * the user always sees both sources and knows which one is off.
 */
export function InactiveWaveRow({
  label,
  hint,
  size = 'sm',
}: {
  label: string;
  hint: string;
  size?: 'sm' | 'lg';
}) {
  return (
    <div className="flex items-center gap-2.5 opacity-60">
      <span
        className={cn(
          'shrink-0 font-semibold uppercase tracking-wider text-muted-foreground',
          size === 'lg' ? 'w-12 text-[10px]' : 'w-9 text-[9px]',
        )}
      >
        {label}
      </span>
      <div className={cn('flex flex-1 items-center', size === 'lg' ? 'h-9' : 'h-6')}>
        <div className="h-px flex-1 rounded-full bg-muted-foreground/30" />
      </div>
      <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{hint}</span>
    </div>
  );
}

function Waveform({
  level,
  tone,
  size,
}: {
  level: number;
  tone: 'mic' | 'system';
  size: 'sm' | 'lg';
}) {
  // History is mutated in place each animation frame and a forced re-render
  // reads it — cheaper than allocating a new array 60×/sec for 40 bars.
  const historyRef = useRef<number[]>(new Array(WAVE_BARS).fill(0));
  const levelRef = useRef(level);
  levelRef.current = level;
  const [, forceRender] = useReducer((n: number) => (n + 1) % 1_000_000, 0);

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const h = historyRef.current;
      h.push(levelRef.current);
      h.shift();
      forceRender();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const barColor = tone === 'mic' ? 'bg-emerald-500' : 'bg-teal-400';
  return (
    <div className={cn('flex flex-1 items-center gap-px', size === 'lg' ? 'h-9' : 'h-6')} aria-hidden>
      {historyRef.current.map((v, i) => {
        const height = Math.max(0.12, Math.min(1, v * 1.4));
        // Older samples (left) fade out for a trailing-comet feel.
        const opacity = 0.35 + (i / WAVE_BARS) * 0.65;
        return (
          <span
            key={i}
            className={cn('w-full rounded-full', barColor)}
            style={{ height: `${height * 100}%`, opacity }}
          />
        );
      })}
    </div>
  );
}
