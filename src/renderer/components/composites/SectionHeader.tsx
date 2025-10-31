/**
 * SectionHeader Component - consistent section header with optional divider
 */

import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import { SizeVariant, sizeTextClasses } from './tokens';

export interface SectionHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Size variant */
  size?: SizeVariant;
  /** Include bottom border/divider */
  divided?: boolean;
  /** Header title */
  title?: React.ReactNode;
  /** Supporting text */
  description?: React.ReactNode;
  /** Right-side action/control */
  action?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * SectionHeader - consistent section header with optional divider and description.
 *
 * @example
 * <SectionHeader title="Quick Links" description="Fast access" />
 */
export const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({
    size = 'normal',
    divided = true,
    title,
    description,
    action,
    children,
    className,
    ...props
  }, ref) => {
    const padding = size === 'compact' ? 'px-2 py-1' : size === 'spacious' ? 'px-4 py-2' : 'px-2 py-1.5';
    const textSize = sizeTextClasses[size];

    return (
      <div
        ref={ref}
        className={cn(
          padding,
          divided && 'border-b border-border',
          'flex-shrink-0',
          className
        )}
        {...props}
      >
        {children ? (
          children
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div>
                {title && <div className={cn(textSize, 'font-medium')}>{title}</div>}
                {description && (
                  <div className={cn(textSize, 'text-muted-foreground text-[0.85em]')}>
                    {description}
                  </div>
                )}
              </div>
              {action && <div className="flex-shrink-0">{action}</div>}
            </div>
          </>
        )}
      </div>
    );
  }
);
SectionHeader.displayName = 'SectionHeader';
