/**
 * CompactCard Component - simplified card for grid/card views
 *
 * Implements: specs/components.ts#CompactCardProps
 * Replaces: className="text-left p-2 rounded-md transition-all"
 */

import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import { SizeVariant, sizeTextClasses } from './tokens';

export interface CompactCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Size variant */
  size?: SizeVariant;
  /** Card title */
  title?: React.ReactNode;
  /** Whether card is active */
  isActive?: boolean;
  /** Card content */
  children?: React.ReactNode;
}

/**
 * CompactCard - simplified card for grid/card views.
 *
 * @example
 * <CompactCard title="Note Title" isActive={isActive}>
 *   Preview content
 * </CompactCard>
 */
export const CompactCard = React.forwardRef<HTMLDivElement, CompactCardProps>(
  ({ size = 'normal', title, isActive = false, children, className, ...props }, ref) => {
    const padding = size === 'compact' ? 'p-1.5' : size === 'spacious' ? 'p-3' : 'p-2';
    const textSize = sizeTextClasses[size];

    return (
      <div
        ref={ref}
        className={cn(
          padding,
          textSize,
          'rounded-md transition-all',
          isActive
            ? 'bg-accent text-accent-foreground ring-1 ring-primary shadow-sm'
            : 'bg-background border border-border hover:bg-muted/50',
          className,
        )}
        {...props}
      >
        {title && <div className="font-medium line-clamp-2 mb-1">{title}</div>}
        {children && (
          <div className={isActive ? '' : 'text-muted-foreground opacity-70'}>{children}</div>
        )}
      </div>
    );
  },
);
CompactCard.displayName = 'CompactCard';
