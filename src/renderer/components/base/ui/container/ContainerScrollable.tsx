import * as React from 'react';
import { cn } from '@renderer/lib/utils';

export type ScrollDirection = 'vertical' | 'horizontal' | 'both';

const scrollDirectionClasses: Record<ScrollDirection, string> = {
  vertical: 'overflow-y-auto overflow-x-hidden',
  horizontal: 'overflow-x-auto overflow-y-hidden',
  both: 'overflow-auto',
};

export interface ContainerScrollableProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: ScrollDirection;
  maxHeight?: string;
  hideScrollbar?: boolean;
  children: React.ReactNode;
}

export const ContainerScrollable = React.forwardRef<HTMLDivElement, ContainerScrollableProps>(
  (
    { direction = 'vertical', maxHeight, hideScrollbar = false, className, children, ...props },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          scrollDirectionClasses[direction],
          hideScrollbar && 'scrollbar-hide',
          className,
        )}
        style={{ maxHeight }}
        {...props}
      >
        {children}
      </div>
    );
  },
);
ContainerScrollable.displayName = 'ContainerScrollable';
