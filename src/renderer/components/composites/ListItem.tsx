/**
 * ListItem Component - consistent list item styling
 *
 * Replaces: className="w-full text-left px-3 py-1.5 transition-colors border-b border-border"
 */

import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import { SizeVariant, sizeTextClasses } from './tokens';

export interface ListItemProps extends Omit<React.HTMLAttributes<HTMLButtonElement>, 'title'> {
  /** Size variant */
  size?: SizeVariant;
  /** Whether item is active */
  isActive?: boolean;
  /** Left content (icon, etc) */
  left?: React.ReactNode;
  /** Right content (icons, badges) */
  right?: React.ReactNode;
  /** Primary text */
  title?: React.ReactNode;
  /** Secondary text */
  subtitle?: React.ReactNode;
  /** Full content if not using title/subtitle */
  children?: React.ReactNode;
}

/**
 * ListItem - consistent list item styling without inline classes.
 *
 * @example
 * <ListItem
 *   isActive={activeId === item.id}
 *   onClick={() => setActive(item.id)}
 *   title="Note Title"
 *   subtitle="Preview text..."
 *   right={<Star />}
 * />
 */
export const ListItem = React.forwardRef<HTMLButtonElement, ListItemProps>(
  ({
    size = 'normal',
    isActive = false,
    left,
    right,
    title,
    subtitle,
    children,
    className,
    ...props
  }, ref) => {
    const padding = size === 'compact' ? 'px-2 py-1' : size === 'spacious' ? 'px-4 py-2.5' : 'px-3 py-1.5';
    const textSize = sizeTextClasses[size];

    return (
      <button
        ref={ref}
        className={cn(
          'w-full text-left',
          padding,
          textSize,
          'transition-colors border-b border-border',
          'flex items-center gap-2',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-muted/50',
          className
        )}
        {...props}
      >
        {left && <div className="flex-shrink-0">{left}</div>}

        <div className="flex-1 min-w-0">
          {children}
          {!children && (
            <>
              {title && (
                <div className="line-clamp-1 font-medium">
                  {title}
                </div>
              )}
              {subtitle && (
                <div className="line-clamp-1 text-muted-foreground opacity-70 text-[0.85em]">
                  {subtitle}
                </div>
              )}
            </>
          )}
        </div>

        {right && <div className="flex-shrink-0 flex items-center">{right}</div>}
      </button>
    );
  }
);
ListItem.displayName = 'ListItem';
