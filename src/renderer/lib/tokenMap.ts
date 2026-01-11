/**
 * Token Mapping - Maps spec tokens to Tailwind classes
 *
 * This is the bridge between language-agnostic specs and React/Tailwind.
 * Other implementations would have their own mapping:
 * - SwiftUI: tokenMap.swift (maps to SwiftUI modifiers)
 * - Compose: TokenMap.kt (maps to Compose Modifiers)
 */

import { type SizeVariant } from '@/specs';

// =============================================================================
// SPACING → Tailwind
// =============================================================================

export const spacingClass = {
  none: '0',
  xs: '1', // 4px
  sm: '2', // 8px
  md: '4', // 16px
  lg: '6', // 24px
  xl: '8', // 32px
  xxl: '12', // 48px
} as const;

export const paddingX = {
  xs: 'px-1',
  sm: 'px-2',
  md: 'px-4',
  lg: 'px-6',
  xl: 'px-8',
} as const;

export const paddingY = {
  xs: 'py-1',
  sm: 'py-1.5',
  md: 'py-2',
  lg: 'py-3',
  xl: 'py-4',
} as const;

export const gap = {
  xs: 'gap-0.5',
  sm: 'gap-1',
  md: 'gap-2',
  lg: 'gap-3',
} as const;

// =============================================================================
// HEIGHT → Tailwind
// =============================================================================

export const height = {
  compact: 'h-6', // 24px
  normal: 'h-8', // 32px
  spacious: 'h-10', // 40px
  roomy: 'h-12', // 48px
} as const;

export const minHeight = {
  compact: 'min-h-6',
  normal: 'min-h-8',
  spacious: 'min-h-10',
  roomy: 'min-h-12',
} as const;

// =============================================================================
// TYPOGRAPHY → Tailwind
// =============================================================================

export const fontSize = {
  xs: 'text-xs', // 12px
  sm: 'text-sm', // 13-14px
  base: 'text-base', // 14-16px
  lg: 'text-lg', // 16-18px
  xl: 'text-xl', // 20px
  '2xl': 'text-2xl', // 24px
  '3xl': 'text-3xl', // 30px
  '4xl': 'text-4xl', // 36px
  '5xl': 'text-5xl', // 48px
} as const;

export const fontWeight = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
} as const;

export const lineHeight = {
  tight: 'leading-tight',
  snug: 'leading-snug',
  normal: 'leading-normal',
  relaxed: 'leading-relaxed',
} as const;

// =============================================================================
// BORDER RADIUS → Tailwind
// =============================================================================

export const radius = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
} as const;

// =============================================================================
// ICON SIZE → Tailwind
// =============================================================================

export const iconSize = {
  xs: 'w-3 h-3', // 12px
  sm: 'w-3.5 h-3.5', // 14px
  md: 'w-4 h-4', // 16px
  lg: 'w-5 h-5', // 20px
  xl: 'w-6 h-6', // 24px
} as const;

// =============================================================================
// SIZE VARIANTS (composite)
// =============================================================================

export const sizeVariant: Record<
  SizeVariant,
  {
    height: string;
    text: string;
    padding: string;
    icon: string;
  }
> = {
  compact: {
    height: height.compact,
    text: fontSize.xs,
    padding: 'px-2 py-1',
    icon: iconSize.sm,
  },
  normal: {
    height: height.normal,
    text: fontSize.sm,
    padding: 'px-3 py-1.5',
    icon: iconSize.md,
  },
  spacious: {
    height: height.spacious,
    text: fontSize.base,
    padding: 'px-4 py-2',
    icon: iconSize.lg,
  },
  roomy: {
    height: height.roomy,
    text: fontSize.lg,
    padding: 'px-6 py-3',
    icon: iconSize.xl,
  },
};

// =============================================================================
// LAYOUT → Tailwind
// =============================================================================

export const layout = {
  sidebarWidth: {
    min: 'min-w-[200px]',
    default: 'w-60', // 240px
    max: 'max-w-[400px]',
  },
  noteListWidth: {
    min: 'min-w-[280px]',
    default: 'w-80', // 320px
    max: 'max-w-[480px]',
  },
  editorWidth: {
    max: 'max-w-[900px]',
    padding: 'px-16',
  },
} as const;

// =============================================================================
// Z-INDEX → Tailwind
// =============================================================================

export const zIndex = {
  base: 'z-0',
  dropdown: 'z-50',
  modal: 'z-100',
  tooltip: 'z-[150]',
  toast: 'z-[200]',
} as const;

// =============================================================================
// ANIMATION → Tailwind
// =============================================================================

export const duration = {
  fast: 'duration-100',
  normal: 'duration-200',
  slow: 'duration-300',
} as const;

export const easing = {
  default: 'ease-out',
  in: 'ease-in',
  out: 'ease-out',
  inOut: 'ease-in-out',
} as const;

// =============================================================================
// SPACER HELPERS
// =============================================================================

export const spacerVertical = {
  xs: 'h-1',
  sm: 'h-2',
  md: 'h-4',
  lg: 'h-6',
  xl: 'h-8',
} as const;

export const spacerHorizontal = {
  xs: 'w-1',
  sm: 'w-2',
  md: 'w-4',
  lg: 'w-6',
  xl: 'w-8',
} as const;

// =============================================================================
// JUSTIFY/ALIGN → Tailwind
// =============================================================================

export const justify = {
  start: 'justify-start',
  center: 'justify-center',
  between: 'justify-between',
  end: 'justify-end',
} as const;

export const align = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
} as const;

// =============================================================================
// COMBINED EXPORT
// =============================================================================

export const tw = {
  spacing: spacingClass,
  paddingX,
  paddingY,
  gap,
  height,
  minHeight,
  fontSize,
  fontWeight,
  lineHeight,
  radius,
  iconSize,
  sizeVariant,
  layout,
  zIndex,
  duration,
  easing,
  spacerVertical,
  spacerHorizontal,
  justify,
  align,
} as const;

export default tw;
