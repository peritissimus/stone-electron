/**
 * QuickLink Component - button-style link with icon and label
 *
 * Implements: specs/components.ts#QuickLinkProps
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
  ({ size = 'normal', icon, label, isActive = false, className, ...props }, ref) => {
    const height = sizeHeightClasses[size];
    const padding = size === 'compact' ? 'px-1.5' : size === 'spacious' ? 'px-3' : 'px-2';
    const textSize = sizeTextClasses[size];
    const gap = size === 'compact' ? 'gap-1' : 'gap-1.5';

    return (
      <button
        type="button"
        ref={ref}
        className={cn(
          'w-full',
          height,
          padding,
          textSize,
          gap,
          'flex items-center justify-start',
          'rounded-md',
          'transition-[background-color,transform] duration-150 ease-out active:scale-[0.96]',
          isActive ? 'bg-accent/40' : 'hover:bg-accent/20',
          isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
          className,
        )}
        {...props}
      >
        {icon && (
          <div
            className={cn(
              'flex-shrink-0 flex items-center transition-colors duration-150',
              isActive ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {icon}
          </div>
        )}
        <span className="flex-1 text-left">{label}</span>
      </button>
    );
  },
);
QuickLink.displayName = 'QuickLink';
