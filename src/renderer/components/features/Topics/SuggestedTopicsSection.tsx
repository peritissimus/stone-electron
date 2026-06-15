/**
 * SuggestedTopicsSection — appears above the manual "Topics" section on the
 * Knowledge page. Each card represents an unsupervised cluster the user can
 * Adopt (creates a real topic + assigns the member notes) or Dismiss (hidden
 * for the rest of this session).
 *
 * Renames the suggestion inline before adopt so the auto-label can be edited
 * without a separate modal.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  Check,
  Lightbulb,
  Plus,
  X,
} from '@phosphor-icons/react';
import { Button } from '@renderer/components/base/ui/button';
import { Input } from '@renderer/components/base/ui/input';
import { useSuggestedTopics } from '@renderer/hooks/useSuggestedTopics';
import { useNavigateToNote } from '@renderer/navigation';
import { cn } from '@renderer/lib/utils';
import type { SuggestedTopic } from '@shared/types';

/** Collapse preference survives restarts — purely a UI choice. Collapsed by
 *  default: suggestions are an offer, not the page's content — the user's
 *  own topics come first. */
const COLLAPSED_KEY = 'knowledge-suggested-collapsed';

export function SuggestedTopicsSection() {
  const { suggestions, loading, adopting, hasLoadedOnce, refresh, dismiss, adopt } =
    useSuggestedTopics();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_KEY) !== 'false',
  );

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem(COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  if (!hasLoadedOnce && loading) {
    return (
      <section className="space-y-2">
        <SectionHeader
          count={null}
          loading
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          onRefresh={refresh}
        />
        {!collapsed && (
          <div className="rounded-md border border-dashed border-border/60 px-3 py-6 text-center text-xs text-muted-foreground">
            Looking for topical clusters…
          </div>
        )}
      </section>
    );
  }

  if (hasLoadedOnce && suggestions.length === 0) {
    return null; // Nothing to show — hide entirely.
  }

  return (
    <section className="space-y-2">
      <SectionHeader
        count={suggestions.length}
        loading={loading}
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        onRefresh={refresh}
      />
      {!collapsed && (
        <div
          className="animate-in fade-in slide-in-from-top-1 space-y-2"
          style={{ animationDuration: '200ms' }}
        >
          {suggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              adopting={adopting === s.id}
              onAdopt={(name) => adopt(s.id, name)}
              onDismiss={() => dismiss(s.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SectionHeader({
  count,
  loading,
  collapsed,
  onToggle,
  onRefresh,
}: {
  count: number | null;
  loading: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className={cn(
          'group relative flex items-center gap-1.5 rounded-md py-1 pr-2 text-xs font-medium uppercase tracking-wider text-muted-foreground',
          'transition-[color,transform] duration-150 ease-out hover:text-foreground active:scale-[0.98]',
          // Extend the hit area without growing the visible row.
          "before:absolute before:inset-[-6px] before:content-['']",
        )}
        title={collapsed ? 'Show suggestions' : 'Hide suggestions'}
      >
        <CaretRight
          size={10}
          weight="bold"
          className={cn(
            'transition-transform duration-150 ease-out',
            !collapsed && 'rotate-90',
          )}
        />
        <Lightbulb size={12} weight="fill" className="text-primary" />
        Suggested
        {count !== null && (
          <span className="tabular-nums text-muted-foreground/70">({count})</span>
        )}
      </button>
      <Button
        variant="ghost"
        size="sm"
        disabled={loading}
        onClick={onRefresh}
        className="text-xs"
        title="Re-cluster chunks to find new topic suggestions"
      >
        <ArrowsClockwise size={14} className={cn(loading && 'animate-spin')} />
        Refresh
      </Button>
    </div>
  );
}

interface SuggestionCardProps {
  suggestion: SuggestedTopic;
  adopting: boolean;
  onAdopt: (name: string) => Promise<boolean>;
  onDismiss: () => void;
}

function SuggestionCard({ suggestion, adopting, onAdopt, onDismiss }: SuggestionCardProps) {
  const [name, setName] = useState(suggestion.label);
  // A refresh can re-label the same cluster id; re-seed the editable name
  // when the prop actually changes so the card doesn't show a stale label.
  const [prevLabel, setPrevLabel] = useState(suggestion.label);
  if (suggestion.label !== prevLabel) {
    setPrevLabel(suggestion.label);
    setName(suggestion.label);
  }
  const [expanded, setExpanded] = useState(false);
  const navigateToNote = useNavigateToNote();

  const cohesionPct = useMemo(
    () => Math.round(Math.max(0, Math.min(1, suggestion.cohesion)) * 100),
    [suggestion.cohesion],
  );

  const handleAdopt = useCallback(async () => {
    const finalName = name.trim();
    if (!finalName) return;
    await onAdopt(finalName);
  }, [name, onAdopt]);

  return (
    <article
      className={cn(
        'rounded-lg border border-border/60 bg-card/40 px-3 py-2.5',
        'transition-[border-color,background-color] duration-150 ease-out',
        'hover:border-border',
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground',
            'transition-[background-color,transform] duration-150 ease-out active:scale-[0.92]',
            'hover:bg-muted hover:text-foreground',
          )}
          aria-label={expanded ? 'Hide examples' : 'Show examples'}
        >
          {expanded ? <CaretDown size={12} weight="bold" /> : <CaretRight size={12} weight="bold" />}
        </button>

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleAdopt();
            }
          }}
          disabled={adopting}
          className="h-7 max-w-xs border-transparent bg-transparent text-sm font-medium hover:border-border focus-visible:border-input"
        />

        <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          <span>{suggestion.noteCount} notes</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{cohesionPct}% cohesion</span>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={adopting}
            onClick={onDismiss}
            className="text-xs text-muted-foreground hover:text-foreground"
            title="Hide this suggestion"
          >
            <X size={14} />
            Dismiss
          </Button>
          <Button
            size="sm"
            disabled={adopting || !name.trim()}
            onClick={handleAdopt}
            title="Create a topic with this name and assign the matching notes"
          >
            {adopting ? (
              <ArrowsClockwise size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            {adopting ? 'Adopting…' : 'Adopt'}
          </Button>
        </div>
      </div>

      {suggestion.altLabels.length > 0 && (
        <div className="mt-1.5 ml-8 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>Also tried:</span>
          {suggestion.altLabels.map((alt) => (
            <button
              key={alt}
              type="button"
              onClick={() => setName(alt)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5',
                'transition-[background-color,border-color] duration-150 ease-out',
                'hover:border-border hover:bg-muted',
              )}
            >
              <Check size={10} className="opacity-0 group-hover:opacity-100" />
              {alt}
            </button>
          ))}
        </div>
      )}

      {expanded && suggestion.representatives.length > 0 && (
        <ul className="mt-3 ml-8 space-y-1.5">
          {suggestion.representatives.map((rep) => {
            const heading =
              rep.headingPath.length > 0 ? rep.headingPath.join(' › ') : null;
            return (
              <li key={rep.chunkId}>
                <button
                  type="button"
                  onClick={() => navigateToNote(rep.noteId)}
                  className={cn(
                    'w-full rounded-md px-2 py-1.5 text-left',
                    'transition-[background-color,transform] duration-150 ease-out active:scale-[0.99]',
                    'hover:bg-muted/60',
                  )}
                >
                  <div className="truncate text-sm text-foreground">{rep.noteTitle}</div>
                  {heading && (
                    <div className="truncate text-xs text-muted-foreground">{heading}</div>
                  )}
                  <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground/80">
                    {rep.excerpt}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
