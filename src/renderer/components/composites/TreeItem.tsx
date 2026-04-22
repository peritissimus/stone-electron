/**
 * TreeItem Component - consistent tree item with indentation
 *
 * Implements: specs/components.ts#TreeItemProps
 * Replaces: style={{ paddingLeft: `${level * 10 + 2}px` }} and custom button styling
 */

import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import { SizeVariant, sizeTextClasses } from './tokens';
import { Button } from '@renderer/components/base/ui/button';
import { Text } from '@renderer/components/base/ui/text';
import { ContainerFlex } from '@renderer/components/base/ui';

export interface TreeItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Size variant */
  size?: SizeVariant;
  /** Whether item is active */
  isActive?: boolean;
  /** Tree level (for indentation) */
  level?: number;
  /** Indent amount per level (px) */
  indentPx?: number;
  /** Icon/emoji to display */
  icon?: React.ReactNode;
  /** Item label */
  label: React.ReactNode;
  /** Right side content (count, badge, etc) */
  right?: React.ReactNode;
  /** Props for the right slot container */
  rightSlotProps?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;
}

/**
 * TreeItem - consistent tree item styling with automatic indentation.
 *
 * @example
 * <TreeItem
 *   level={0}
 *   isActive={isActive}
 *   onClick={onSelect}
 *   icon="📁"
 *   label="Notebooks"
 *   right={<Badge>{count}</Badge>}
 * />
 */
export const TreeItem = React.memo(React.forwardRef<HTMLButtonElement, TreeItemProps>(
  (
    {
      size = 'normal',
      isActive = false,
      level = 0,
      indentPx = 10,
      icon,
      label,
      right,
      rightSlotProps,
      children,
      className,
      ...props
    },
    ref,
  ) => {
    const textSize = sizeTextClasses[size];
    const padding = size === 'compact' ? 'py-0.5' : size === 'spacious' ? 'py-2' : 'py-1';
    const paddingLeft = level * indentPx + 2;
    const {
      className: rightClassName,
      onClick: rightOnClick,
      onPointerDown: rightOnPointerDown,
      onPointerUp: rightOnPointerUp,
      ...restRightSlotProps
    } = rightSlotProps ?? {};

    return (
      <>
        <ContainerFlex
          align="center"
          gap="none"
          justify={right ? 'between' : 'start'}
          className="px-1 w-full"
          style={{ paddingLeft: `${paddingLeft}px` }}
        >
          <Button
            ref={ref}
            type="button"
            variant="ghost"
            className={cn(
              'flex-1 min-w-0 justify-start gap-1.5 px-1.5 text-left',
              padding,
              textSize,
              'h-auto rounded-md',
              isActive
                ? 'bg-secondary text-accent-foreground hover:bg-accent/90'
                : 'hover:bg-muted/50',
              className,
            )}
            {...props}
          >
            {icon && (
              <Text size="sm" as="span" className="flex-shrink-0">
                {icon}
              </Text>
            )}
            <Text as="span" size="xs" className="flex-1 truncate text-left">
              {label}
            </Text>
          </Button>
          {right && (
            <div
              {...restRightSlotProps}
              className={cn('ml-2 flex items-center gap-1 flex-shrink-0', rightClassName)}
              onClick={(event) => {
                event.stopPropagation();
                rightOnClick?.(event);
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                rightOnPointerDown?.(event);
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
                rightOnPointerUp?.(event);
              }}
            >
              {right}
            </div>
          )}
        </ContainerFlex>

        {children}
      </>
    );
  },
));
TreeItem.displayName = 'TreeItem';
