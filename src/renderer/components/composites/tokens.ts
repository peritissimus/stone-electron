/**
 * Design Tokens for Composite Components
 *
 * Re-exports from the central token map, which derives from specs.
 * Chain: specs/tokens.ts → lib/tokenMap.ts → here
 *
 * Token-based sizing system:
 * - compact: Tight spacing, small text (12px titles, 4px gaps)
 * - normal: Standard spacing, normal text (13px)
 * - spacious: Relaxed spacing, larger text (14px)
 * - roomy: Extra spacing, larger text (16px)
 */

import { tw } from '@renderer/lib/tokenMap';
import type { SizeVariant } from '@renderer/specs';

// Re-export SizeVariant from specs
export type { SizeVariant };

// Typography sizes by variant (maps SizeVariant → Tailwind class)
export const sizeTextClasses: Record<SizeVariant, string> = {
  compact: tw.fontSize.xs,
  normal: tw.fontSize.sm,
  spacious: tw.fontSize.base,
  roomy: tw.fontSize.lg,
};

// Height by size variant
export const sizeHeightClasses: Record<SizeVariant, string> = {
  compact: tw.height.compact,
  normal: tw.height.normal,
  spacious: tw.height.spacious,
  roomy: tw.height.roomy,
};

// Padding by size variant (legacy - prefer sizeVariant)
export const sizePaddingClasses = {
  compact: 'p-1',
  normal: 'p-2',
  spacious: 'p-3',
  roomy: 'p-4',
} as const;

// Gap/spacing classes
export const gapClasses = tw.gap;

// Spacer size classes
export const spacerSizeClasses = {
  xs: { vertical: tw.spacerVertical.xs, horizontal: tw.spacerHorizontal.xs },
  sm: { vertical: tw.spacerVertical.sm, horizontal: tw.spacerHorizontal.sm },
  md: { vertical: tw.spacerVertical.md, horizontal: tw.spacerHorizontal.md },
  lg: { vertical: tw.spacerVertical.lg, horizontal: tw.spacerHorizontal.lg },
  xl: { vertical: tw.spacerVertical.xl, horizontal: tw.spacerHorizontal.xl },
} as const;

// Justify classes
export const justifyClasses = tw.justify;

// Complete size variant (recommended)
export const sizeVariant = tw.sizeVariant;
