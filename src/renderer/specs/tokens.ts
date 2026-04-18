/**
 * Design Tokens - Raw values for cross-platform implementation
 *
 * These are semantic values (not CSS classes) that can be mapped to:
 * - Web: Tailwind/CSS
 * - iOS: UIKit/SwiftUI
 * - Android: Compose/XML
 * - Desktop: Qt/GTK/native
 */

// =============================================================================
// SPACING
// =============================================================================

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const gap = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
} as const;

// =============================================================================
// SIZING
// =============================================================================

export const height = {
  compact: 24,
  normal: 32,
  spacious: 40,
  roomy: 48,
} as const;

export const iconSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
} as const;

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const fontSize = {
  xs: 12,
  sm: 13,
  base: 14,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
} as const;

export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const lineHeight = {
  tight: 1.2,
  snug: 1.35,
  normal: 1.5,
  relaxed: 1.65,
} as const;

// =============================================================================
// BORDER RADIUS
// =============================================================================

export const radius = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  full: 9999,
} as const;

// =============================================================================
// COLORS (HSL values for flexibility)
// =============================================================================

export const accentHues = {
  blue: 211,
  purple: 270,
  pink: 330,
  red: 0,
  orange: 30,
  green: 142,
  teal: 180,
} as const;

export const semanticColors = {
  // These are HSL triplets: [hue, saturation%, lightness%]
  light: {
    background: [0, 0, 100],
    foreground: [0, 0, 10],
    muted: [0, 0, 96],
    mutedForeground: [0, 0, 45],
    border: [0, 0, 90],
    card: [0, 0, 100],
    cardForeground: [0, 0, 10],
  },
  dark: {
    background: [0, 0, 7],
    foreground: [0, 0, 95],
    muted: [0, 0, 15],
    mutedForeground: [0, 0, 60],
    border: [0, 0, 20],
    card: [0, 0, 10],
    cardForeground: [0, 0, 95],
  },
} as const;

// =============================================================================
// ANIMATION
// =============================================================================

export const duration = {
  fast: 100,
  normal: 200,
  slow: 300,
} as const;

export const easing = {
  default: 'ease-out',
  in: 'ease-in',
  out: 'ease-out',
  inOut: 'ease-in-out',
} as const;

// =============================================================================
// LAYOUT
// =============================================================================

export const sidebarWidth = {
  min: 200,
  default: 240,
  max: 400,
} as const;

export const noteListWidth = {
  min: 280,
  default: 320,
  max: 480,
} as const;

export const editorWidth = {
  max: 900,
  padding: 64, // horizontal padding
} as const;

// =============================================================================
// Z-INDEX
// =============================================================================

export const zIndex = {
  base: 0,
  dropdown: 50,
  modal: 100,
  tooltip: 150,
  toast: 200,
} as const;

// =============================================================================
// SIZE VARIANTS (composite)
// =============================================================================

export type SizeVariant = 'compact' | 'normal' | 'spacious' | 'roomy';

export const sizeVariants: Record<
  SizeVariant,
  {
    height: number;
    fontSize: number;
    padding: { x: number; y: number };
    iconSize: number;
  }
> = {
  compact: {
    height: height.compact,
    fontSize: fontSize.xs,
    padding: { x: spacing.sm, y: spacing.xs },
    iconSize: iconSize.sm,
  },
  normal: {
    height: height.normal,
    fontSize: fontSize.sm,
    padding: { x: spacing.md, y: spacing.sm },
    iconSize: iconSize.md,
  },
  spacious: {
    height: height.spacious,
    fontSize: fontSize.base,
    padding: { x: spacing.md, y: spacing.sm },
    iconSize: iconSize.lg,
  },
  roomy: {
    height: height.roomy,
    fontSize: fontSize.lg,
    padding: { x: spacing.lg, y: spacing.md },
    iconSize: iconSize.xl,
  },
};
