/**
 * QuickLink Component - button-style link with icon and label
 *
 * Replaces: className="w-full justify-start h-6 px-2 text-xs gap-1.5"
 */

import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import { SizeVariant, sizeHeightClasses, sizeTextClasses } from './tokens';

export interface QuickLinkProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Size variant */
  size?: SizeVariant;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Link label */
  label: React.ReactNode;
  /** Whether link is active */
  isActive?: boolean;
}

/**
 * QuickLink - button-style link with icon and label.
 *
 * @example
 * <QuickLink icon={<Star />} label="Favorites" isActive={panel === 'favorites'} />
 */
export const QuickLink = React.forwardRef<HTMLButtonElement, QuickLinkProps>(
  ({
    size = 'normal',
    icon,
    label,
    isActive = false,
    className,
    ...props
  }, ref) => {
    const height = sizeHeightClasses[size];
    const padding = size === 'compact' ? 'px-1.5' : size === 'spacious' ? 'px-3' : 'px-2';
    const textSize = sizeTextClasses[size];
    const gap = size === 'compact' ? 'gap-1' : 'gap-1.5';

    return (
      <button
        ref={ref}
        className={cn(
          'w-full',
          height,
          padding,
          textSize,
          gap,
          'flex items-center justify-start',
          'rounded-md',
          'transition-colors',
          'hover:bg-muted',
          isActive && 'bg-accent text-accent-foreground',
          className
        )}
        {...props}
      >
        {icon && <div className="flex-shrink-0 flex items-center">{icon}</div>}
        <span className="flex-1 text-left">{label}</span>
      </button>
    );
  }
);
QuickLink.displayName = 'QuickLink';
