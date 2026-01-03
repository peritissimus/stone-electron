/**
 * IconButton Component - preset icon button
 *
 * Implements: specs/components.ts#IconButtonProps
 * Replaces: className="h-7 w-7 p-0 flex-shrink-0"
 */

import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import { SizeVariant, sizeHeightClasses } from './tokens';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Size variant */
  size?: SizeVariant;
  /** Icon to display */
  icon: React.ReactNode;
  /** Button label (for aria-label) */
  label?: string;
  /** Tooltip text */
  tooltip?: string;
}

/**
 * IconButton - preset icon button without className needed.
 *
 * @example
 * <IconButton size="compact" icon={<Settings />} label="Settings" />
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = 'normal', icon, label, tooltip, className, ...props }, ref) => {
    const sizeClasses = sizeHeightClasses[size];

    return (
      <button
        ref={ref}
        className={cn(
          sizeClasses,
          'aspect-square',
          'p-0 flex items-center justify-center',
          'flex-shrink-0',
          'rounded-md',
          'transition-colors',
          'hover:bg-muted',
          'active:bg-muted/80',
          className,
        )}
        aria-label={label || tooltip}
        title={tooltip}
        {...props}
      >
        {icon}
      </button>
    );
  },
);
IconButton.displayName = 'IconButton';
