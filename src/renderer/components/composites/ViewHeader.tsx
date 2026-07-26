/**
 * ViewHeader — the title bar every top-level view shares.
 *
 * Deliberately has no icon slot. The sidebar already marks which view you are
 * in with that same glyph, so repeating it in the header carried no information
 * and competed with the action icons beside it, which do.
 */

import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import { sizeHeightClasses } from './tokens';

export interface ViewHeaderProps {
  /** The view's name. */
  title: string;
  /**
   * One short detail that the body cannot already show at a glance — today's
   * date, a filtered count. Hidden on narrow viewports, so never put anything
   * here the view depends on.
   */
  meta?: React.ReactNode;
  /** Trailing controls, right-aligned. */
  actions?: React.ReactNode;
  className?: string;
}

export function ViewHeader({ title, meta, actions, className }: ViewHeaderProps) {
  return (
    <header
      className={cn(
        'flex min-w-0 shrink-0 items-center gap-3 overflow-hidden border-b border-border bg-card px-4',
        'max-[900px]:gap-1.5 max-[900px]:px-2',
        sizeHeightClasses.spacious,
        className,
      )}
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="shrink-0 text-sm font-semibold">{title}</h1>
        {meta ? (
          <span className="truncate text-xs text-muted-foreground tabular-nums max-[900px]:hidden">
            {meta}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1" />
      {actions}
    </header>
  );
}
