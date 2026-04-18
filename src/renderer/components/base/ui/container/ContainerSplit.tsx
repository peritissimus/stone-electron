import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import {
  type ClusterGap,
  type ClusterAlign,
  stackGapClasses,
  clusterAlignClasses,
} from './shared';

export type SplitBreakpoint = 'sm' | 'md' | 'lg';
export type SplitRatio = '1:1' | '1:2' | '2:1' | '1:3' | '3:1';

const splitBreakpointClasses: Record<SplitBreakpoint, string> = {
  sm: 'sm:flex-row',
  md: 'md:flex-row',
  lg: 'lg:flex-row',
};

const splitRatioClasses: Record<SplitRatio, string> = {
  '1:1': '*:flex-1',
  '1:2': '[&>*:first-child]:flex-1 [&>*:last-child]:flex-2',
  '2:1': '[&>*:first-child]:flex-2 [&>*:last-child]:flex-1',
  '1:3': '[&>*:first-child]:flex-1 [&>*:last-child]:flex-3',
  '3:1': '[&>*:first-child]:flex-3 [&>*:last-child]:flex-1',
};

export interface ContainerSplitProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: ClusterGap;
  ratio?: SplitRatio;
  breakpoint?: SplitBreakpoint;
  align?: ClusterAlign;
  reverseOnMobile?: boolean;
  children: React.ReactNode;
}

export const ContainerSplit = React.forwardRef<HTMLDivElement, ContainerSplitProps>(
  (
    {
      gap = 'lg',
      ratio = '1:1',
      breakpoint = 'md',
      align = 'stretch',
      reverseOnMobile = false,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex',
          reverseOnMobile ? 'flex-col-reverse' : 'flex-col',
          splitBreakpointClasses[breakpoint],
          stackGapClasses[gap],
          clusterAlignClasses[align],
          splitRatioClasses[ratio],
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
ContainerSplit.displayName = 'ContainerSplit';
