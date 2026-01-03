/**
 * ListContainer Component - wrapper for lists with layout based on view mode
 *
 * Implements: specs/components.ts#ListContainerProps
 */

import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import { SizeVariant } from './tokens';

export interface ListContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** View mode affects layout */
  viewMode?: 'list' | 'grid' | 'card';
  /** Size variant */
  size?: SizeVariant;
  children: React.ReactNode;
}

/**
 * ListContainer - wrapper for lists with appropriate layout based on view mode.
 * Handles grid/card spacing automatically.
 *
 * @example
 * <ListContainer viewMode={viewMode}>
 *   {items.map(item => <ListItem key={item.id} {...item} />)}
 * </ListContainer>
 */
export const ListContainer = React.forwardRef<HTMLDivElement, ListContainerProps>(
  ({ viewMode = 'list', size = 'normal', children, className, ...props }, ref) => {
    const gridGap = size === 'compact' ? 'gap-1' : size === 'spacious' ? 'gap-3' : 'gap-2';
    const gridPadding = size === 'compact' ? 'p-1' : size === 'spacious' ? 'p-3' : 'p-2';

    if (viewMode === 'list') {
      return (
        <div
          ref={ref}
          className={cn(
            'divide-y divide-border',
            className
          )}
          {...props}
        >
          {children}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          gridPadding,
          viewMode === 'grid' ? 'grid grid-cols-2' : 'grid grid-cols-1',
          gridGap,
          'bg-card',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ListContainer.displayName = 'ListContainer';
