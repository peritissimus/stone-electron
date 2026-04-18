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

export type FlexDirection = 'row' | 'row-reverse' | 'col' | 'col-reverse';
export type FlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse';

const flexDirectionClasses: Record<FlexDirection, string> = {
  row: 'flex-row',
  'row-reverse': 'flex-row-reverse',
  col: 'flex-col',
  'col-reverse': 'flex-col-reverse',
};

const flexWrapClasses: Record<FlexWrap, string> = {
  nowrap: 'flex-nowrap',
  wrap: 'flex-wrap',
  'wrap-reverse': 'flex-wrap-reverse',
};

export interface ContainerFlexProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: FlexDirection;
  gap?: ClusterGap;
  wrap?: FlexWrap;
  justify?: ClusterJustify;
  align?: ClusterAlign;
  children: React.ReactNode;
}

export const ContainerFlex = React.forwardRef<HTMLDivElement, ContainerFlexProps>(
  (
    {
      direction = 'row',
      gap = 'md',
      wrap = 'nowrap',
      justify = 'start',
      align = 'stretch',
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
          flexDirectionClasses[direction],
          stackGapClasses[gap],
          flexWrapClasses[wrap],
          clusterJustifyClasses[justify],
          clusterAlignClasses[align],
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
ContainerFlex.displayName = 'ContainerFlex';
