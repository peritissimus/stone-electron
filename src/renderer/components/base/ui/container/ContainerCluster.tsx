import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import {
  type ClusterGap,
  type ClusterJustify,
  type ClusterAlign,
  stackGapClasses,
  clusterJustifyClasses,
  clusterAlignClasses,
} from './shared';

export type { ClusterGap, ClusterJustify, ClusterAlign };

export interface ContainerClusterProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: ClusterGap;
  justify?: ClusterJustify;
  align?: ClusterAlign;
  wrap?: boolean;
  children: React.ReactNode;
}

export const ContainerCluster = React.forwardRef<HTMLDivElement, ContainerClusterProps>(
  (
    { gap = 'md', justify = 'start', align = 'center', wrap = true, className, children, ...props },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex',
          stackGapClasses[gap],
          clusterJustifyClasses[justify],
          clusterAlignClasses[align],
          wrap ? 'flex-wrap' : 'flex-nowrap',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
ContainerCluster.displayName = 'ContainerCluster';
