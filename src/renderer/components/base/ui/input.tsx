import * as React from 'react';

import { cn } from '@renderer/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm',
          'ring-offset-background transition-[border-color,box-shadow] duration-150 ease-out',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
          'placeholder:text-muted-foreground',
          // A hairline, not a band: focus only has to say "the caret is here",
          // and a 2px ring stacked on an opaque border reads as an alert.
          'focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring/25 focus-visible:border-ring/60 focus-visible:ring-offset-0',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
