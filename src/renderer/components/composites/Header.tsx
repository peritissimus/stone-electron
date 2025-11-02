/**
 * Header Component - consistent top navigation/title areas
 *
 * Replaces: className="px-3 pt-titlebar pb-2.5 border-b border-border"
 */

import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import { SizeVariant, sizeHeightClasses } from './tokens';

export interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size variant */
  size?: SizeVariant;
  /** Include bottom border */
  divided?: boolean;
  /** Left content */
  left?: React.ReactNode;
  /** Right content */
  right?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Header component - combines consistent top padding, border, and spacing.
 *
 * @example
 * <Header left={<Heading3>Notes</Heading3>} right={<Button>New</Button>} />
 */
export const Header = React.forwardRef<HTMLDivElement, HeaderProps>(
  ({ size = 'normal', divided = true, left, right, children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'px-3 border-b border-l border-r border-border',
          sizeHeightClasses[size],
          'flex-shrink-0 bg-card',
          'flex items-center justify-between',
          className,
        )}
        {...props}
      >
        {left && <div className="ml-[72px] flex-1">{left}</div>}
        {children && <div className="flex-1">{children}</div>}
        {right && <div className="flex items-center">{right}</div>}
      </div>
    );
  },
);
Header.displayName = 'Header';
