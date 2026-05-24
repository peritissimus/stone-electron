import * as React from 'react';

import { cn } from '@renderer/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'ring-offset-background transition-[border-color,box-shadow] duration-150 ease-out',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring focus-visible:ring-offset-0',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
