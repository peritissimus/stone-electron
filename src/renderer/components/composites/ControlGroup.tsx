/**
 * ControlGroup Component - containers for related buttons/toggles
 *
 * Implements: specs/components.ts#ControlGroupProps
 * Replaces: className="flex items-center gap-0.5 bg-muted rounded-md p-0.5"
 */

import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import { SizeVariant, gapClasses } from './tokens';

export interface ControlGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size variant */
  size?: SizeVariant;
  /** Gap between controls */
  gap?: 'xs' | 'sm' | 'md';
  /** Allow wrapping */
  wrap?: boolean;
  /** Background color for the group */
  background?: string;
  children: React.ReactNode;
}

/**
 * ControlGroup - containers for related buttons/toggles without inline classes.
 * Provides consistent spacing and optional background grouping.
 *
 * @example
 * <ControlGroup gap="sm" background="bg-muted">
 *   <Toggle pressed={mode === 'list'}><List /></Toggle>
 *   <Toggle pressed={mode === 'grid'}><Grid /></Toggle>
 * </ControlGroup>
 */
export const ControlGroup = React.forwardRef<HTMLDivElement, ControlGroupProps>(
  (
    {
      size = 'normal',
      gap = 'sm',
      wrap = false,
      background = 'bg-muted',
      children,
      className,
      ...props
    },
    ref,
  ) => {
    const padding = size === 'compact' ? 'p-0.5' : size === 'spacious' ? 'p-1' : 'p-0.5';

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center',
          gapClasses[gap],
          wrap ? 'flex-wrap' : 'flex-nowrap',
          padding,
          background,
          'rounded-md',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
ControlGroup.displayName = 'ControlGroup';
