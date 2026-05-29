/**
 * AskNotesPanel - centered floating modal for "ask my notes".
 *
 * Visually mirrors the Command Center: input on top, divider, scrollable
 * answer + sources body, footer with kbd hints. Open/close + escape are
 * driven by Radix Dialog primitives so focus management and a11y come for
 * free; styling is fully custom so it matches the popover aesthetic instead
 * of the default DialogContent treatment.
 */

import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowRight, Sparkle } from 'phosphor-react';
import { useUI } from '@renderer/hooks/useUI';
import { useAskNotes } from '@renderer/hooks/useAskNotes';
import { useNavigateToNote } from '@renderer/navigation';
import { SourceCitationList } from './SourceCitationList';

export function AskNotesPanel() {
  const { askNotesOpen, closeAskNotes } = useUI();
  const { query, answer, sources, loading, error, setQuery, submit, clear } = useAskNotes();
  const navigateToNote = useNavigateToNote();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!askNotesOpen) return;
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 60);
    return () => window.clearTimeout(id);
  }, [askNotesOpen]);

  const handleSubmit = useCallback(() => {
    if (!query.trim() || loading) return;
    void submit();
  }, [query, loading, submit]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleOpenSource = useCallback(
    (noteId: string) => {
      navigateToNote(noteId);
      closeAskNotes();
    },
    [navigateToNote, closeAskNotes],
  );

  const hasAnswer = answer.length > 0 && !loading;
  const hasContent = loading || !!error || !!answer || sources.length > 0;
  const canClear = !loading && (!!query || !!answer || !!error);

  return (
    <DialogPrimitive.Root
      open={askNotesOpen}
      onOpenChange={(open) => {
        if (!open) closeAskNotes();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={[
            'fixed inset-0 z-50 bg-foreground/40 dark:bg-black/60 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          ].join(' ')}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={[
            'fixed left-[50%] top-[12vh] z-50 w-[calc(100%-2rem)] max-w-2xl translate-x-[-50%]',
            'flex flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-2xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
            'data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2',
          ].join(' ')}
        >
          <DialogPrimitive.Title className="sr-only">Ask Notes</DialogPrimitive.Title>

          {/* Input row */}
          <div className="flex items-center gap-3 px-4 py-3">
            <Sparkle
              size={18}
              weight="fill"
              className="shrink-0 text-primary"
            />
            <input
              ref={inputRef}
              type="text"
              aria-label="Ask anything about your notes"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your notes…"
              disabled={loading}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className={[
                'flex-1 bg-transparent text-base text-foreground',
                'placeholder:text-muted-foreground/60 outline-none',
                'disabled:cursor-not-allowed disabled:opacity-60',
              ].join(' ')}
            />
            {loading && (
              <div
                className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-primary"
                aria-hidden
              />
            )}
          </div>

          {hasContent && <div className="h-px bg-border" />}

          {/* Body */}
          {hasContent && (
            <div className="max-h-[55vh] overflow-y-auto p-4">
              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              {loading && (
                <div className="space-y-2">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
                </div>
              )}

              {hasAnswer && (
                <div className="space-y-4">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground text-pretty">
                    {answer}
                  </div>
                  {sources.length > 0 && (
                    <SourceCitationList sources={sources} onOpen={handleOpenSource} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between gap-3 bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground/70">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono">↵</kbd>
                <span>ask</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono">esc</kbd>
                <span>close</span>
              </span>
              {canClear && (
                <button
                  type="button"
                  onClick={clear}
                  className={[
                    'inline-flex items-center gap-1 rounded px-1.5 py-0.5',
                    'text-muted-foreground/80 hover:text-foreground hover:bg-muted',
                    'transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]',
                  ].join(' ')}
                >
                  clear
                </button>
              )}
            </div>
            <div className="inline-flex items-center gap-1">
              <span>Ask Notes</span>
              <ArrowRight size={11} weight="bold" className="opacity-60" />
              <kbd className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono">⌘⇧A</kbd>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
