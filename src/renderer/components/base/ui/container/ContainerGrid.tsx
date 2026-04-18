import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import { type StackGap, stackGapClasses } from './shared';

export type GridCols = 1 | 2 | 3 | 4 | 5 | 6 | 12 | 'auto-fit' | 'auto-fill';
export type GridGap = StackGap;

const gridColsClasses: Record<GridCols, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  12: 'grid-cols-12',
  'auto-fit': 'grid-cols-[repeat(auto-fit,minmax(250px,1fr))]',
  'auto-fill': 'grid-cols-[repeat(auto-fill,minmax(250px,1fr))]',
};

export interface ContainerGridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: GridCols;
  gap?: GridGap;
  mobileCols?: 1 | 2;
  tabletCols?: 2 | 3 | 4;
  children: React.ReactNode;
}

export const ContainerGrid = React.forwardRef<HTMLDivElement, ContainerGridProps>(
  ({ cols = 3, gap = 'md', mobileCols, tabletCols, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'grid',
          stackGapClasses[gap],
          mobileCols === 1 && 'grid-cols-1',
          mobileCols === 2 && 'grid-cols-2',
          tabletCols && `md:${gridColsClasses[tabletCols]}`,
          `lg:${gridColsClasses[cols]}`,
          !mobileCols && gridColsClasses[cols],
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
ContainerGrid.displayName = 'ContainerGrid';
