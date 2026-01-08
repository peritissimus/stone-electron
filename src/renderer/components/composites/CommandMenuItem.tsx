/**
 * CommandMenuItem Component - Menu item with icon, title, and description
 *
 * Used in: SlashCommandMenu, BlockMenu, FloatingBlockMenu
 * Pattern: icon + title + description in a consistent layout
 */

import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import { SizeVariant } from './tokens';

export interface CommandMenuItemProps {
  /** Icon element */
  icon: React.ReactNode;
  /** Primary text */
  title: string;
  /** Secondary description text */
  description?: string;
  /** Size variant */
  size?: SizeVariant;
  /** Whether item is selected/active */
  isSelected?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Mouse enter handler (for hover selection) */
  onMouseEnter?: () => void;
  /** Additional class names */
  className?: string;
  /** Render as div (for use inside DropdownMenuItem) */
  asChild?: boolean;
}

const sizeConfig = {
  compact: {
    padding: 'px-2 py-1.5',
    gap: 'gap-2',
    iconSize: 14,
    titleClass: 'text-xs font-medium',
    descClass: 'text-[10px] text-muted-foreground',
  },
  normal: {
    padding: 'px-3 py-2',
    gap: 'gap-3',
    iconSize: 16,
    titleClass: 'text-sm font-medium',
    descClass: 'text-xs text-muted-foreground',
  },
  spacious: {
    padding: 'px-3 py-2.5',
    gap: 'gap-3',
    iconSize: 18,
    titleClass: 'text-sm font-medium',
    descClass: 'text-xs text-muted-foreground',
  },
  roomy: {
    padding: 'px-4 py-3',
    gap: 'gap-4',
    iconSize: 20,
    titleClass: 'text-base font-medium',
    descClass: 'text-sm text-muted-foreground',
  },
} as const;

/**
 * CommandMenuItem - Consistent menu item layout for command menus
 *
 * @example
 * // Standalone button (SlashCommandMenu)
 * <CommandMenuItem
 *   icon={<TextHOne size={18} />}
 *   title="Heading 1"
 *   description="Large section heading"
 *   isSelected={selectedIndex === 0}
 *   onClick={() => selectItem(0)}
 * />
 *
 * @example
 * // Inside DropdownMenuItem
 * <DropdownMenuItem onClick={handleClick}>
 *   <CommandMenuItem
 *     asChild
 *     icon={<TextHOne size={16} />}
 *     title="Heading 1"
 *     description="Large section heading"
 *   />
 * </DropdownMenuItem>
 */
export const CommandMenuItem = React.forwardRef<HTMLButtonElement, CommandMenuItemProps>(
  (
    {
      icon,
      title,
      description,
      size = 'normal',
      isSelected = false,
      onClick,
      onMouseEnter,
      className,
      asChild = false,
    },
    ref
  ) => {
    const config = sizeConfig[size];

    const content = (
      <>
        <div className="flex-shrink-0 text-muted-foreground">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className={config.titleClass}>{title}</div>
          {description && (
            <div className={cn(config.descClass, 'line-clamp-1')}>{description}</div>
          )}
        </div>
      </>
    );

    // Render as div for use inside DropdownMenuItem
    if (asChild) {
      return (
        <div className={cn('flex items-start', config.gap, className)}>
          {content}
        </div>
      );
    }

    // Render as button for standalone use
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        className={cn(
          'w-full flex items-start text-left',
          config.padding,
          config.gap,
          'rounded-md transition-colors',
          'hover:bg-accent cursor-pointer',
          isSelected && 'bg-accent',
          className
        )}
      >
        {content}
      </button>
    );
  }
);

CommandMenuItem.displayName = 'CommandMenuItem';
