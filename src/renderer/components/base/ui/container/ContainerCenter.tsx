import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import { type ContainerSize, sizeClasses } from './shared';

export interface ContainerCenterProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: ContainerSize;
  centerVertically?: boolean;
  minHeight?: string;
  children: React.ReactNode;
}

export const ContainerCenter = React.forwardRef<HTMLDivElement, ContainerCenterProps>(
  (
    { maxWidth = 'md', centerVertically = false, minHeight, className, children, ...props },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'mx-auto px-4',
          sizeClasses[maxWidth],
          centerVertically && 'flex items-center justify-center',
          className,
        )}
        style={{ minHeight }}
        {...props}
      >
        {children}
      </div>
    );
  },
);
ContainerCenter.displayName = 'ContainerCenter';
