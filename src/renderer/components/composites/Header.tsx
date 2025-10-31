/**
 * Header Component - consistent top navigation/title areas
 *
 * Replaces: className="px-3 pt-titlebar pb-2.5 border-b border-border"
 */

import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import { SizeVariant } from './tokens';

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
    const paddingY = size === 'compact' ? 'py-1.5' : size === 'spacious' ? 'py-3' : 'py-2';

    return (
      <div
        ref={ref}
        className={cn(
          'px-3 pt-titlebar',
          paddingY,
          divided && 'border-b border-border',
          'flex-shrink-0 bg-card',
          'flex items-center justify-between',
          className
        )}
        {...props}
      >
        {left && <div className="flex-1">{left}</div>}
        {children && <div className="flex-1">{children}</div>}
        {right && <div className="flex items-center">{right}</div>}
      </div>
    );
  }
);
Header.displayName = 'Header';
