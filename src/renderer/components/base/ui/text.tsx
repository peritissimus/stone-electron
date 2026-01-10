import * as React from 'react';
import { cn } from '@renderer/lib/utils';

export type TextVariant =
  | 'default'
  | 'muted'
  | 'accent'
  | 'destructive'
  | 'secondary'
  | 'success'
  | 'warning';

export type TextSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';

export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold';

export type TextElement = 'p' | 'span' | 'div' | 'label' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  variant?: TextVariant;
  size?: TextSize;
  weight?: TextWeight;
  as?: TextElement;
  className?: string;
  children: React.ReactNode;
}

const variantClasses: Record<TextVariant, string> = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  accent: 'text-accent-foreground',
  destructive: 'text-destructive',
  secondary: 'text-secondary-foreground',
  success: 'text-success',
  warning: 'text-warning',
};

const sizeClasses: Record<TextSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
  '4xl': 'text-4xl',
  '5xl': 'text-5xl',
  '6xl': 'text-6xl',
};

const weightClasses: Record<TextWeight, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

export const Text = React.forwardRef<HTMLElement, TextProps>(
  (
    {
      variant = 'default',
      size = 'base',
      weight = 'normal',
      as: Component = 'p',
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const classes = cn(
      variantClasses[variant],
      sizeClasses[size],
      weightClasses[weight],
      className,
    );

    return React.createElement(
      Component,
      {
        ref,
        className: classes,
        ...props,
      },
      children,
    );
  },
);

Text.displayName = 'Text';

// Convenience components for common use cases
export const Heading1 = React.forwardRef<
  HTMLHeadingElement,
  Omit<TextProps, 'as' | 'size' | 'weight'>
>(({ className, ...props }, ref) => (
  <Text
    ref={ref}
    as="h1"
    size="4xl"
    weight="bold"
    className={cn('scroll-m-20 tracking-tight', className)}
    {...props}
  />
));
Heading1.displayName = 'Heading1';

export const Heading2 = React.forwardRef<
  HTMLHeadingElement,
  Omit<TextProps, 'as' | 'size' | 'weight'>
>(({ className, ...props }, ref) => (
  <Text
    ref={ref}
    as="h2"
    size="3xl"
    weight="semibold"
    className={cn('scroll-m-20 tracking-tight', className)}
    {...props}
  />
));
Heading2.displayName = 'Heading2';

export const Heading3 = React.forwardRef<
  HTMLHeadingElement,
  Omit<TextProps, 'as' | 'size' | 'weight'>
>(({ className, ...props }, ref) => (
  <Text
    ref={ref}
    as="h3"
    size="2xl"
    weight="semibold"
    className={cn('scroll-m-20 tracking-tight', className)}
    {...props}
  />
));
Heading3.displayName = 'Heading3';

export const Heading4 = React.forwardRef<
  HTMLHeadingElement,
  Omit<TextProps, 'as' | 'size' | 'weight'>
>(({ className, ...props }, ref) => (
  <Text
    ref={ref}
    as="h4"
    size="xl"
    weight="semibold"
    className={cn('scroll-m-20 tracking-tight', className)}
    {...props}
  />
));
Heading4.displayName = 'Heading4';

export const Body = React.forwardRef<HTMLParagraphElement, Omit<TextProps, 'as'>>(
  ({ className, ...props }, ref) => (
    <Text ref={ref} as="p" className={cn('leading-7', className)} {...props} />
  ),
);
Body.displayName = 'Body';

export const Caption = React.forwardRef<HTMLSpanElement, Omit<TextProps, 'as' | 'size'>>(
  ({ className, ...props }, ref) => (
    <Text
      ref={ref}
      as="span"
      size="xs"
      className={cn('text-muted-foreground', className)}
      {...props}
    />
  ),
);
Caption.displayName = 'Caption';

type LabelProps = Omit<TextProps, 'as' | 'size' | 'weight'> &
  React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <Text
      // Cast ref to HTMLElement to satisfy Text's ref type
      ref={ref as unknown as React.Ref<HTMLElement>}
      as="label"
      size="sm"
      weight="medium"
      className={cn(
        'leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      // Pass through all label-specific attributes (e.g., htmlFor)
      {...(props as any)}
    />
  ),
);
Label.displayName = 'Label';
