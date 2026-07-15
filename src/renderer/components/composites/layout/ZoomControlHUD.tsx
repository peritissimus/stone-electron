import { Minus, Plus } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@renderer/lib/utils';

const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;
const STORAGE_KEY = 'stone.ui.zoom';
const DISMISS_DELAY_MS = 1800;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function readStoredZoom(): number {
  const stored = Number.parseInt(localStorage.getItem(STORAGE_KEY) ?? '', 10);
  return Number.isFinite(stored) ? clampZoom(stored) : DEFAULT_ZOOM;
}

export function ZoomControlHUD() {
  const [zoom, setZoom] = useState(readStoredZoom);
  const [visible, setVisible] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTemporarily = useCallback(() => {
    setVisible(true);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => setVisible(false), DISMISS_DELAY_MS);
  }, []);

  const updateZoom = useCallback(
    (nextZoom: number) => {
      const clamped = clampZoom(nextZoom);
      setZoom(clamped);
      showTemporarily();
    },
    [showTemporarily],
  );

  useEffect(() => {
    document.documentElement.style.zoom = '100%';
    document.documentElement.style.setProperty('--stone-content-zoom', String(zoom / 100));
    localStorage.setItem(STORAGE_KEY, String(zoom));
  }, [zoom]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;

      if (event.key === '=' || event.key === '+') {
        event.preventDefault();
        updateZoom(zoom + ZOOM_STEP);
      } else if (event.key === '-') {
        event.preventDefault();
        updateZoom(zoom - ZOOM_STEP);
      } else if (event.key === '0') {
        event.preventDefault();
        updateZoom(DEFAULT_ZOOM);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [updateZoom, zoom]);

  useEffect(
    () => () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    },
    [],
  );

  return (
    <div
      role="group"
      aria-label="Zoom controls"
      className={cn(
        'fixed left-1/2 top-3 z-[100] flex h-11 -translate-x-1/2 items-center rounded-2xl bg-popover/95 px-2 shadow-[0_0_0_1px_hsl(var(--foreground)/0.12),0_8px_24px_hsl(0_0%_0%/0.22)] backdrop-blur-xl',
        'transition-[opacity,transform,filter] duration-200 ease-out',
        visible
          ? 'translate-y-0 opacity-100 blur-0'
          : 'pointer-events-none -translate-y-2 opacity-0 blur-[4px]',
      )}
      onMouseEnter={() => {
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      }}
      onMouseLeave={showTemporarily}
    >
      <span className="min-w-14 px-2 text-center text-sm font-semibold tabular-nums text-foreground">
        {zoom}%
      </span>
      <button
        type="button"
        onClick={() => updateZoom(zoom - ZOOM_STEP)}
        disabled={zoom <= MIN_ZOOM}
        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground active:scale-[0.96] disabled:opacity-30"
        aria-label="Zoom out"
      >
        <Minus size={14} />
      </button>
      <button
        type="button"
        onClick={() => updateZoom(zoom + ZOOM_STEP)}
        disabled={zoom >= MAX_ZOOM}
        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground active:scale-[0.96] disabled:opacity-30"
        aria-label="Zoom in"
      >
        <Plus size={14} />
      </button>
      <div className="mx-1 h-5 w-px bg-border/70" />
      <button
        type="button"
        onClick={() => updateZoom(DEFAULT_ZOOM)}
        disabled={zoom === DEFAULT_ZOOM}
        className="h-8 rounded-lg px-2.5 text-sm text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground active:scale-[0.96] disabled:opacity-40"
      >
        Reset
      </button>
    </div>
  );
}
