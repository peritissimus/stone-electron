/**
 * ToolbarButton Component - consistent toolbar button styling
 *
 * Implements: specs/components.ts#ToolbarButtonProps
 * Replaces: className="p-1.5 rounded transition-colors"
 */

import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import { SizeVariant, sizePaddingClasses } from './tokens';

export interface ToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Size variant */
  size?: SizeVariant;
  /** Whether button is in active/pressed state */
  active?: boolean;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Button label (for aria-label) */
  label?: string;
  /** Tooltip text */
  tooltip?: string;
  children?: React.ReactNode;
}

/**
 * ToolbarButton - preset button for toolbars without inline classes.
 * Replaces: className="p-1.5 rounded transition-colors"
 *
 * @example
 * <ToolbarButton
 *   active={isActive('bold')}
 *   onClick={toggleBold}
 *   tooltip="Bold"
 * >
 *   <Bold size={16} />
 * </ToolbarButton>
 */
export const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  (
    {
      size = 'normal',
      active = false,
      icon,
      label,
      tooltip,
      disabled = false,
      children,
      className,
      ...props
    },
    ref,
  ) => {
    const padding = sizePaddingClasses[size];

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          padding,
          'rounded transition-colors',
          active
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-muted text-muted-foreground hover:text-foreground',
          disabled && 'opacity-40 cursor-not-allowed',
          className,
        )}
        aria-label={label || tooltip}
        title={tooltip}
        {...props}
      >
        {icon || children}
      </button>
    );
  },
);
ToolbarButton.displayName = 'ToolbarButton';

// ============================================================================
// TOOLBAR DIVIDER
// ============================================================================

export interface ToolbarDividerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Divider size */
  size?: 'sm' | 'md' | 'lg';
}

const dividerSizeClasses: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-4',
  md: 'h-5',
  lg: 'h-6',
};

/**
 * ToolbarDivider - vertical divider for toolbar sections.
 * Replaces: <div className="w-px h-5 bg-border mx-1" />
 *
 * @example
 * <ToolbarButton><Bold /></ToolbarButton>
 * <ToolbarDivider />
 * <ToolbarButton><Italic /></ToolbarButton>
 */
export const ToolbarDivider = React.forwardRef<HTMLDivElement, ToolbarDividerProps>(
  ({ size = 'md', className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('w-px bg-border mx-1', dividerSizeClasses[size], className)}
        {...props}
      />
    );
  },
);
ToolbarDivider.displayName = 'ToolbarDivider';
