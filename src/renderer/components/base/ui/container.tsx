/**
 * Container Component System
 *
 * Comprehensive layout container components for common patterns.
 * Inspired by Every Layout (https://every-layout.dev/) and modern CSS patterns.
 */

import * as React from 'react';
import { cn } from '@renderer/lib/utils';

// ============================================================================
// BASE CONTAINER
// ============================================================================

export type ContainerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
export type ContainerPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<ContainerSize, string> = {
  xs: 'max-w-xl',      // 576px - narrow content
  sm: 'max-w-2xl',     // 672px - blog posts
  md: 'max-w-4xl',     // 896px - standard content
  lg: 'max-w-6xl',     // 1152px - wide layouts
  xl: 'max-w-7xl',     // 1280px - very wide
  '2xl': 'max-w-[1400px]', // 1400px - extra wide
  full: 'max-w-full',  // no constraint
};

const paddingClasses: Record<ContainerPadding, string> = {
  none: '',
  sm: 'px-4',
  md: 'px-6',
  lg: 'px-8',
  xl: 'px-12',
};

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Maximum width constraint */
  size?: ContainerSize;
  /** Horizontal padding */
  padding?: ContainerPadding;
  /** Center horizontally */
  centered?: boolean;
  /** Full height */
  fullHeight?: boolean;
  children: React.ReactNode;
}

/**
 * Base container for constraining content width and adding horizontal padding.
 *
 * @example
 * <Container size="md" padding="md">
 *   <Heading2>Content</Heading2>
 * </Container>
 */
export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({
    size = 'lg',
    padding = 'md',
    centered = true,
    fullHeight = false,
    className,
    children,
    ...props
  }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'w-full',
          sizeClasses[size],
          paddingClasses[padding],
          centered && 'mx-auto',
          fullHeight && 'h-full',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Container.displayName = 'Container';

// ============================================================================
// SECTION - Semantic sectioning with consistent spacing
// ============================================================================

export type SectionSpacing = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const sectionSpacingClasses: Record<SectionSpacing, string> = {
  none: '',
  sm: 'py-4',
  md: 'py-8',
  lg: 'py-12',
  xl: 'py-16',
  '2xl': 'py-24',
};

export interface ContainerSectionProps extends React.HTMLAttributes<HTMLElement> {
  /** Vertical spacing (padding top/bottom) */
  spacing?: SectionSpacing;
  /** Background variant */
  background?: 'default' | 'muted' | 'accent';
  /** Full width (no max-width constraint) */
  fullWidth?: boolean;
  children: React.ReactNode;
}

const sectionBackgroundClasses = {
  default: '',
  muted: 'bg-muted/50',
  accent: 'bg-accent/10',
};

/**
 * Semantic section container for page sections with consistent vertical spacing.
 *
 * @example
 * <ContainerSection spacing="lg" background="muted">
 *   <Container>Content here</Container>
 * </ContainerSection>
 */
export const ContainerSection = React.forwardRef<HTMLElement, ContainerSectionProps>(
  ({ spacing = 'md', background = 'default', fullWidth = false, className, children, ...props }, ref) => {
    return (
      <section
        ref={ref}
        className={cn(
          'w-full',
          sectionSpacingClasses[spacing],
          sectionBackgroundClasses[background],
          !fullWidth && 'max-w-7xl mx-auto',
          className
        )}
        {...props}
      >
        {children}
      </section>
    );
  }
);
ContainerSection.displayName = 'ContainerSection';

// ============================================================================
// STACK - Vertical layout with consistent gap
// ============================================================================

export type StackGap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type StackAlign = 'start' | 'center' | 'end' | 'stretch';

const stackGapClasses: Record<StackGap, string> = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
  '2xl': 'gap-12',
};

const stackAlignClasses: Record<StackAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

export interface ContainerStackProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Vertical gap between items */
  gap?: StackGap;
  /** Horizontal alignment */
  align?: StackAlign;
  /** Split layout (space-between) */
  split?: boolean;
  children: React.ReactNode;
}

/**
 * Vertical stack layout with consistent spacing between children.
 *
 * @example
 * <ContainerStack gap="md" align="start">
 *   <Heading2>Title</Heading2>
 *   <Body>Content</Body>
 *   <Button>Action</Button>
 * </ContainerStack>
 */
export const ContainerStack = React.forwardRef<HTMLDivElement, ContainerStackProps>(
  ({ gap = 'md', align = 'stretch', split = false, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col',
          stackGapClasses[gap],
          stackAlignClasses[align],
          split && 'justify-between',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ContainerStack.displayName = 'ContainerStack';

// ============================================================================
// CLUSTER - Horizontal layout with wrap
// ============================================================================

export type ClusterGap = StackGap;
export type ClusterJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
export type ClusterAlign = 'start' | 'center' | 'end' | 'baseline' | 'stretch';

const clusterJustifyClasses: Record<ClusterJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

const clusterAlignClasses: Record<ClusterAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  baseline: 'items-baseline',
  stretch: 'items-stretch',
};

export interface ContainerClusterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Gap between items */
  gap?: ClusterGap;
  /** Horizontal alignment */
  justify?: ClusterJustify;
  /** Vertical alignment */
  align?: ClusterAlign;
  /** Allow wrapping to next line */
  wrap?: boolean;
  children: React.ReactNode;
}

/**
 * Horizontal cluster layout that wraps items with consistent spacing.
 * Perfect for tags, buttons, inline items.
 *
 * @example
 * <ContainerCluster gap="sm" justify="start" wrap>
 *   <Badge>Tag 1</Badge>
 *   <Badge>Tag 2</Badge>
 *   <Badge>Tag 3</Badge>
 * </ContainerCluster>
 */
export const ContainerCluster = React.forwardRef<HTMLDivElement, ContainerClusterProps>(
  ({ gap = 'md', justify = 'start', align = 'center', wrap = true, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex',
          stackGapClasses[gap],
          clusterJustifyClasses[justify],
          clusterAlignClasses[align],
          wrap ? 'flex-wrap' : 'flex-nowrap',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ContainerCluster.displayName = 'ContainerCluster';

// ============================================================================
// GRID - CSS Grid layout
// ============================================================================

export type GridCols = 1 | 2 | 3 | 4 | 5 | 6 | 12 | 'auto-fit' | 'auto-fill';
export type GridGap = StackGap;

const gridColsClasses: Record<GridCols, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  12: 'grid-cols-12',
  'auto-fit': 'grid-cols-[repeat(auto-fit,minmax(250px,1fr))]',
  'auto-fill': 'grid-cols-[repeat(auto-fill,minmax(250px,1fr))]',
};

export interface ContainerGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of columns */
  cols?: GridCols;
  /** Gap between items */
  gap?: GridGap;
  /** Responsive: columns on mobile */
  mobileCols?: 1 | 2;
  /** Responsive: columns on tablet */
  tabletCols?: 2 | 3 | 4;
  children: React.ReactNode;
}

/**
 * CSS Grid layout for multi-column layouts.
 *
 * @example
 * <ContainerGrid cols={3} gap="md" mobileCols={1} tabletCols={2}>
 *   <Card>Item 1</Card>
 *   <Card>Item 2</Card>
 *   <Card>Item 3</Card>
 * </ContainerGrid>
 */
export const ContainerGrid = React.forwardRef<HTMLDivElement, ContainerGridProps>(
  ({ cols = 3, gap = 'md', mobileCols, tabletCols, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'grid',
          stackGapClasses[gap],
          mobileCols === 1 && 'grid-cols-1',
          mobileCols === 2 && 'grid-cols-2',
          tabletCols && `md:${gridColsClasses[tabletCols]}`,
          `lg:${gridColsClasses[cols]}`,
          !mobileCols && gridColsClasses[cols],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ContainerGrid.displayName = 'ContainerGrid';

// ============================================================================
// FLEX - Flexible layout with common patterns
// ============================================================================

export type FlexDirection = 'row' | 'row-reverse' | 'col' | 'col-reverse';
export type FlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse';

const flexDirectionClasses: Record<FlexDirection, string> = {
  row: 'flex-row',
  'row-reverse': 'flex-row-reverse',
  col: 'flex-col',
  'col-reverse': 'flex-col-reverse',
};

const flexWrapClasses: Record<FlexWrap, string> = {
  nowrap: 'flex-nowrap',
  wrap: 'flex-wrap',
  'wrap-reverse': 'flex-wrap-reverse',
};

export interface ContainerFlexProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Flex direction */
  direction?: FlexDirection;
  /** Gap between items */
  gap?: ClusterGap;
  /** Wrapping behavior */
  wrap?: FlexWrap;
  /** Horizontal alignment */
  justify?: ClusterJustify;
  /** Vertical alignment */
  align?: ClusterAlign;
  children: React.ReactNode;
}

/**
 * Flexible layout container with full control over flex properties.
 *
 * @example
 * <ContainerFlex direction="row" justify="between" align="center" gap="md">
 *   <Text>Left content</Text>
 *   <Button>Right action</Button>
 * </ContainerFlex>
 */
export const ContainerFlex = React.forwardRef<HTMLDivElement, ContainerFlexProps>(
  ({
    direction = 'row',
    gap = 'md',
    wrap = 'nowrap',
    justify = 'start',
    align = 'stretch',
    className,
    children,
    ...props
  }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex',
          flexDirectionClasses[direction],
          stackGapClasses[gap],
          flexWrapClasses[wrap],
          clusterJustifyClasses[justify],
          clusterAlignClasses[align],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ContainerFlex.displayName = 'ContainerFlex';

// ============================================================================
// SPLIT - Two-column responsive layout
// ============================================================================

export type SplitBreakpoint = 'sm' | 'md' | 'lg';
export type SplitRatio = '1:1' | '1:2' | '2:1' | '1:3' | '3:1';

const splitBreakpointClasses: Record<SplitBreakpoint, string> = {
  sm: 'sm:flex-row',
  md: 'md:flex-row',
  lg: 'lg:flex-row',
};

const splitRatioClasses: Record<SplitRatio, string> = {
  '1:1': '[&>*]:flex-1',
  '1:2': '[&>*:first-child]:flex-1 [&>*:last-child]:flex-[2]',
  '2:1': '[&>*:first-child]:flex-[2] [&>*:last-child]:flex-1',
  '1:3': '[&>*:first-child]:flex-1 [&>*:last-child]:flex-[3]',
  '3:1': '[&>*:first-child]:flex-[3] [&>*:last-child]:flex-1',
};

export interface ContainerSplitProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Gap between columns */
  gap?: ClusterGap;
  /** Column ratio */
  ratio?: SplitRatio;
  /** Breakpoint to switch from stacked to side-by-side */
  breakpoint?: SplitBreakpoint;
  /** Vertical alignment */
  align?: ClusterAlign;
  /** Reverse order on mobile */
  reverseOnMobile?: boolean;
  children: React.ReactNode;
}

/**
 * Responsive two-column layout that stacks on mobile.
 *
 * @example
 * <ContainerSplit ratio="2:1" gap="lg" breakpoint="md">
 *   <div>Main content (2x width)</div>
 *   <div>Sidebar (1x width)</div>
 * </ContainerSplit>
 */
export const ContainerSplit = React.forwardRef<HTMLDivElement, ContainerSplitProps>(
  ({
    gap = 'lg',
    ratio = '1:1',
    breakpoint = 'md',
    align = 'stretch',
    reverseOnMobile = false,
    className,
    children,
    ...props
  }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex',
          reverseOnMobile ? 'flex-col-reverse' : 'flex-col',
          splitBreakpointClasses[breakpoint],
          stackGapClasses[gap],
          clusterAlignClasses[align],
          splitRatioClasses[ratio],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ContainerSplit.displayName = 'ContainerSplit';

// ============================================================================
// CENTER - Intrinsic centering
// ============================================================================

export interface ContainerCenterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Maximum width of centered content */
  maxWidth?: ContainerSize;
  /** Center both horizontally and vertically */
  centerVertically?: boolean;
  /** Minimum height (for vertical centering) */
  minHeight?: string;
  children: React.ReactNode;
}

/**
 * Centers content horizontally and optionally vertically.
 *
 * @example
 * <ContainerCenter maxWidth="md" centerVertically minHeight="100vh">
 *   <Card>Centered content</Card>
 * </ContainerCenter>
 */
export const ContainerCenter = React.forwardRef<HTMLDivElement, ContainerCenterProps>(
  ({ maxWidth = 'md', centerVertically = false, minHeight, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'mx-auto px-4',
          sizeClasses[maxWidth],
          centerVertically && 'flex items-center justify-center',
          className
        )}
        style={{ minHeight }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ContainerCenter.displayName = 'ContainerCenter';

// ============================================================================
// SCROLLABLE - Scrollable container with customizable behavior
// ============================================================================

export type ScrollDirection = 'vertical' | 'horizontal' | 'both';

const scrollDirectionClasses: Record<ScrollDirection, string> = {
  vertical: 'overflow-y-auto overflow-x-hidden',
  horizontal: 'overflow-x-auto overflow-y-hidden',
  both: 'overflow-auto',
};

export interface ContainerScrollableProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Scroll direction */
  direction?: ScrollDirection;
  /** Maximum height */
  maxHeight?: string;
  /** Hide scrollbar */
  hideScrollbar?: boolean;
  children: React.ReactNode;
}

/**
 * Scrollable container with customizable scroll behavior.
 *
 * @example
 * <ContainerScrollable direction="vertical" maxHeight="500px">
 *   {longContentList}
 * </ContainerScrollable>
 */
export const ContainerScrollable = React.forwardRef<HTMLDivElement, ContainerScrollableProps>(
  ({ direction = 'vertical', maxHeight, hideScrollbar = false, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          scrollDirectionClasses[direction],
          hideScrollbar && 'scrollbar-hide',
          className
        )}
        style={{ maxHeight }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ContainerScrollable.displayName = 'ContainerScrollable';

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Types are exported inline above
};
