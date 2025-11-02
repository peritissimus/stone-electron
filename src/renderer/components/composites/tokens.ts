/**
 * Design Tokens for Composite Components
 *
 * Token-based sizing system:
 * - compact: Tight spacing, small text (12px titles, 4px gaps)
 * - normal: Standard spacing, normal text (13px)
 * - spacious: Relaxed spacing, larger text (14px)
 */

export type SizeVariant = 'compact' | 'normal' | 'spacious' | 'roomy';

// Typography sizes by variant
export const sizeTextClasses: Record<SizeVariant, string> = {
  compact: 'text-xs',      // 12px
  normal: 'text-sm',       // 13px (default)
  spacious: 'text-base',   // 14px
  roomy: 'text-lg',        // 16px
};

// Padding by size variant
export const sizePaddingClasses: Record<SizeVariant, string> = {
  compact: 'p-1',          // 4px
  normal: 'p-2',           // 8px
  spacious: 'p-3',         // 12px
  roomy: 'p-4',            // 16px
};

// Height by size variant
export const sizeHeightClasses: Record<SizeVariant, string> = {
  compact: 'h-6',          // 24px
  normal: 'h-8',           // 32px
  spacious: 'h-10',        // 40px
  roomy: 'h-12',           // 48px
};

// Gap/spacing classes
export const gapClasses: Record<'xs' | 'sm' | 'md', string> = {
  xs: 'gap-0.5',
  sm: 'gap-1',
  md: 'gap-2',
};

export const spacerSizeClasses: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', Record<'vertical' | 'horizontal', string>> = {
  xs: { vertical: 'h-1', horizontal: 'w-1' },
  sm: { vertical: 'h-2', horizontal: 'w-2' },
  md: { vertical: 'h-4', horizontal: 'w-4' },
  lg: { vertical: 'h-6', horizontal: 'w-6' },
  xl: { vertical: 'h-8', horizontal: 'w-8' },
};

export const justifyClasses: Record<'start' | 'center' | 'between' | 'end', string> = {
  start: 'justify-start',
  center: 'justify-center',
  between: 'justify-between',
  end: 'justify-end',
};
