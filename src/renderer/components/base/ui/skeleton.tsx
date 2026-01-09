import React from 'react';
import { cn } from '@renderer/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-md bg-gradient-to-r from-muted/30 via-muted/50 to-muted/30 bg-[length:200%_100%] animate-shimmer',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
