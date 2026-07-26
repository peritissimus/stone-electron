/**
 * Reports what happened to the note's last write.
 *
 * Autosave runs on an idle timer, so the reader never asks for a save and never
 * finds out it failed. "Saved" is reassurance; the failure state is the reason
 * this exists, and it offers a retry rather than just naming the problem.
 */

import { useEffect, useState } from 'react';
import { CircleNotch, Warning } from '@phosphor-icons/react';
import { useSaveStatus } from '@renderer/services/documents/hooks/useSaveStatus';
import { cn } from '@renderer/lib/utils';

/**
 * Local writes finish in single-digit milliseconds. Announcing every one of them
 * would strobe the status bar, so a spinner only appears if the write is slow
 * enough that silence would look like nothing happened.
 */
const SPINNER_DELAY_MS = 300;

export interface SaveIndicatorProps {
  noteId: string | null;
}

export function SaveIndicator({ noteId }: SaveIndicatorProps) {
  const { status, error, retry } = useSaveStatus(noteId);

  const [spinnerVisible, setSpinnerVisible] = useState(false);
  useEffect(() => {
    if (status !== 'saving') {
      setSpinnerVisible(false);
      return;
    }
    const timer = setTimeout(() => setSpinnerVisible(true), SPINNER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [status]);

  if (!noteId) return null;

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={retry}
        title={error}
        className={cn(
          'flex items-center gap-1.5 rounded px-1.5 py-0.5 text-destructive',
          'transition-colors duration-150 hover:bg-destructive/10',
        )}
      >
        <Warning size={12} weight="fill" />
        <span>Save failed</span>
        <span className="underline decoration-dotted">Retry</span>
      </button>
    );
  }

  if (spinnerVisible) {
    return (
      <span className="flex items-center gap-1.5">
        <CircleNotch size={12} className="animate-spin" />
        Saving…
      </span>
    );
  }

  // A fast save leaves the buffer dirty for only a few milliseconds; calling
  // that "Unsaved" would flicker, so the calm label covers it.
  if (status === 'unsaved') {
    return <span className="text-muted-foreground/70">Unsaved</span>;
  }

  return <span>Saved</span>;
}
