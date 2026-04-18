import * as React from 'react';
import { cn } from '@renderer/lib/utils';

export type SectionSpacing = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const sectionSpacingClasses: Record<SectionSpacing, string> = {
  none: '',
  sm: 'py-4',
  md: 'py-8',
  lg: 'py-12',
  xl: 'py-16',
  '2xl': 'py-24',
};

const sectionBackgroundClasses = {
  default: '',
  muted: 'bg-muted/50',
  accent: 'bg-accent/10',
};

export interface ContainerSectionProps extends React.HTMLAttributes<HTMLElement> {
  spacing?: SectionSpacing;
  background?: 'default' | 'muted' | 'accent';
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const ContainerSection = React.forwardRef<HTMLElement, ContainerSectionProps>(
  (
    { spacing = 'md', background = 'default', fullWidth = false, className, children, ...props },
    ref,
  ) => {
    return (
      <section
        ref={ref}
        className={cn(
          'w-full',
          sectionSpacingClasses[spacing],
          sectionBackgroundClasses[background],
          !fullWidth && 'max-w-7xl mx-auto',
          className,
        )}
        {...props}
      >
        {children}
      </section>
    );
  },
);
ContainerSection.displayName = 'ContainerSection';
