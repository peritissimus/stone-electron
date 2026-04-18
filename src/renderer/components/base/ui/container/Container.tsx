import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import {
  type ContainerSize,
  type ContainerPadding,
  sizeClasses,
  paddingClasses,
} from './shared';

export type { ContainerSize, ContainerPadding };

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: ContainerSize;
  padding?: ContainerPadding;
  centered?: boolean;
  fullHeight?: boolean;
  children: React.ReactNode;
}

export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  (
    {
      size = 'lg',
      padding = 'md',
      centered = true,
      fullHeight = false,
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
          'w-full',
          sizeClasses[size],
          paddingClasses[padding],
          centered && 'mx-auto',
          fullHeight && 'h-full',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
Container.displayName = 'Container';
