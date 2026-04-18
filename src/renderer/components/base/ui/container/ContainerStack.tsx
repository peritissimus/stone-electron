import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import {
  type StackGap,
  type StackAlign,
  stackGapClasses,
  stackAlignClasses,
} from './shared';

export type { StackGap, StackAlign };

export interface ContainerStackProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: StackGap;
  align?: StackAlign;
  split?: boolean;
  children: React.ReactNode;
}

export const ContainerStack = React.forwardRef<HTMLDivElement, ContainerStackProps>(
  ({ gap = 'md', align = 'stretch', split = false, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col',
          stackGapClasses[gap],
          stackAlignClasses[align],
          split && 'justify-between',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
ContainerStack.displayName = 'ContainerStack';
