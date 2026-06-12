/**
 * RelatedNotesPanel — editor sidecar showing notes that are semantically
 * related to the active note (via chunk-to-chunk cosine similarity).
 *
 * Unlike BacklinksPanel (which shows explicit wiki-links), this surfaces
 * connections you didn't make manually. Each row shows the matching heading
 * path and an excerpt of the best chunk so the reason for the match is
 * legible — and a one-click "Link" action inserts a [[wiki-link]] at the
 * cursor, turning the implicit connection into an explicit one. Rows whose
 * note is already linked show a quiet "Linked" state instead.
 */

import { useMemo, useState } from 'react';
import {
  ArrowsInLineVertical,
  ArrowsOutLineVertical,
  CaretDown,
  CaretRight,
  Check,
  Compass,
  Plus,
} from '@phosphor-icons/react';
import { useRelatedNotes } from '@renderer/hooks/useRelatedNotes';
import { useForwardLinks } from '@renderer/hooks/useForwardLinks';
import { useNavigateToNote } from '@renderer/navigation';
import { cn } from '@renderer/lib/utils';
import type { RichTextEditor } from '@renderer/editor';
import type { RelatedNoteMatch } from '@shared/types';

export interface RelatedNotesPanelProps {
  noteId: string;
  /** Active tiptap editor — enables the one-click "Link" action. */
  editor?: RichTextEditor | null;
}

export function RelatedNotesPanel({ noteId, editor }: RelatedNotesPanelProps) {
  const { results, loading, error } = useRelatedNotes(noteId, 5);
  const { linkedIds } = useForwardLinks(noteId);
  const [isExpanded, setIsExpanded] = useState(true);
  // Links inserted this session — flips the row state immediately; the DB
  // catches up after the next save reindexes the note's links.
  const [insertedIds, setInsertedIds] = useState<Set<string>>(() => new Set());
  const navigateToNote = useNavigateToNote();

  const visibleResults = useMemo(
    () => results.filter((r) => r.similarity > 0.4),
    [results],
  );

  const insertLink = (match: RelatedNoteMatch) => {
    if (!editor || editor.isDestroyed) return;
    editor
      .chain()
      .focus()
      .insertNoteLink({ noteId: match.noteId, title: match.title })
      .insertContent(' ')
      .run();
    setInsertedIds((prev) => new Set(prev).add(match.noteId));
  };

  // Hide entirely on first load with nothing — no flash of empty UI.
  if (!loading && visibleResults.length === 0 && !error) {
    return null;
  }

  return (
    <div className="border-t border-border bg-muted/10">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between',
          'px-4 py-2',
          'text-sm font-medium text-muted-foreground',
          'transition-colors hover:bg-muted/30',
        )}
      >
        <div className="flex items-center gap-2">
          <div className="relative size-3.5">
            <div
              className={cn(
                'absolute inset-0 flex items-center justify-center',
                'transition-[opacity,filter,scale] duration-300',
                '[transition-timing-function:cubic-bezier(0.2,0,0,1)]',
                isExpanded
                  ? 'scale-100 opacity-100 blur-0'
                  : 'scale-[0.25] opacity-0 blur-[4px]',
              )}
            >
              <CaretDown size={14} weight="bold" />
            </div>
            <div
              className={cn(
                'absolute inset-0 flex items-center justify-center',
                'transition-[opacity,filter,scale] duration-300',
                '[transition-timing-function:cubic-bezier(0.2,0,0,1)]',
                isExpanded
                  ? 'scale-[0.25] opacity-0 blur-[4px]'
                  : 'scale-100 opacity-100 blur-0',
              )}
            >
              <CaretRight size={14} weight="bold" />
            </div>
          </div>
          <Compass size={14} weight="bold" />
          <span>Related</span>
          {visibleResults.length > 0 && (
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full tabular-nums">
              {visibleResults.length}
            </span>
          )}
        </div>
        <div className="relative size-3.5">
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              'transition-[opacity,filter,scale] duration-300',
              '[transition-timing-function:cubic-bezier(0.2,0,0,1)]',
              isExpanded
                ? 'scale-100 opacity-100 blur-0'
                : 'scale-[0.25] opacity-0 blur-[4px]',
            )}
          >
            <ArrowsInLineVertical size={14} />
          </div>
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              'transition-[opacity,filter,scale] duration-300',
              '[transition-timing-function:cubic-bezier(0.2,0,0,1)]',
              isExpanded
                ? 'scale-[0.25] opacity-0 blur-[4px]'
                : 'scale-100 opacity-100 blur-0',
            )}
          >
            <ArrowsOutLineVertical size={14} />
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-2 pb-2 space-y-1">
          {loading && visibleResults.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              Looking for related notes…
            </div>
          ) : error ? (
            <div className="px-3 py-2 text-xs text-destructive">{error}</div>
          ) : visibleResults.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No related notes found.
            </div>
          ) : (
            <ul className="space-y-1">
              {visibleResults.map((match) => (
                <RelatedRow
                  key={match.noteId}
                  match={match}
                  linked={linkedIds.has(match.noteId) || insertedIds.has(match.noteId)}
                  canLink={Boolean(editor && !editor.isDestroyed)}
                  onClick={() => navigateToNote(match.noteId)}
                  onLink={() => insertLink(match)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

interface RelatedRowProps {
  match: RelatedNoteMatch;
  linked: boolean;
  canLink: boolean;
  onClick: () => void;
  onLink: () => void;
}

function RelatedRow({ match, linked, canLink, onClick, onLink }: RelatedRowProps) {
  const heading =
    match.bestChunk.headingPath.length > 0
      ? match.bestChunk.headingPath.join(' › ')
      : null;
  const similarityPct = Math.round(match.similarity * 100);

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full rounded-md px-2 py-1.5 text-left',
          'transition-[background-color,transform] duration-150 ease-out active:scale-[0.99]',
          'hover:bg-muted/60',
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {match.title}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {linked && (
              <span
                className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
                title="This note is already wiki-linked from the current note"
              >
                <Check size={10} weight="bold" />
                Linked
              </span>
            )}
            <span className="text-[11px] tabular-nums text-muted-foreground/70">
              {similarityPct}%
            </span>
          </div>
        </div>
        {heading && (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{heading}</div>
        )}
        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">
          {match.bestChunk.excerpt}
        </div>
      </button>

      {/* Hover action: insert [[link]] at the cursor. Sits over the row's
          top-right corner; hidden once linked. */}
      {canLink && !linked && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onLink();
          }}
          className={cn(
            'absolute right-1.5 top-1.5 inline-flex h-6 items-center gap-1 rounded-md border border-border bg-background px-1.5 text-[11px] font-medium text-muted-foreground shadow-sm',
            'opacity-0 transition-[opacity,transform,background-color,color] duration-150 ease-out',
            'group-hover:opacity-100 focus-visible:opacity-100',
            'hover:bg-muted hover:text-foreground active:scale-[0.96]',
          )}
          title={`Insert [[${match.title}]] at the cursor`}
        >
          <Plus size={10} weight="bold" />
          Link
        </button>
      )}
    </li>
  );
}
