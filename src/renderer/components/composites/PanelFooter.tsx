/**
 * PanelFooter Component - consistent footer styling
 *
 * Replaces: className="px-2.5 py-2 border-t border-border flex-shrink-0"
 */

import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import { SizeVariant, justifyClasses } from './tokens';

export interface PanelFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size variant */
  size?: SizeVariant;
  /** Include top border */
  divided?: boolean;
  /** Content alignment */
  justify?: 'start' | 'center' | 'between' | 'end';
  children: React.ReactNode;
}

/**
 * PanelFooter - consistent footer styling with border and padding.
 *
 * @example
 * <PanelFooter>
 *   <Button>Action</Button>
 * </PanelFooter>
 */
export const PanelFooter = React.forwardRef<HTMLDivElement, PanelFooterProps>(
  ({
    size = 'normal',
    divided = true,
    justify = 'between',
    children,
    className,
    ...props
  }, ref) => {
    const padding = size === 'compact' ? 'px-2 py-1.5' : size === 'spacious' ? 'px-3 py-2.5' : 'px-2.5 py-2';

    return (
      <div
        ref={ref}
        className={cn(
          padding,
          divided && 'border-t border-border',
          'flex-shrink-0',
          'flex items-center',
          justifyClasses[justify],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
PanelFooter.displayName = 'PanelFooter';
