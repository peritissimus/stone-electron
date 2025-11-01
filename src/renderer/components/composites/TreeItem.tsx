/**
 * TreeItem Component - consistent tree item with indentation
 *
 * Replaces: style={{ paddingLeft: `${level * 10 + 2}px` }} and custom button styling
 */

import * as React from 'react';
import { cn } from '@renderer/lib/utils';
import { SizeVariant, sizeTextClasses } from './tokens';
import { Button } from '@renderer/components/ui/button';
import { Text } from '@renderer/components/ui/text';
import { ContainerFlex } from '@renderer/components/ui';

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
export const TreeItem = React.forwardRef<HTMLButtonElement, TreeItemProps>(
  (
    {
      size = 'normal',
      isActive = false,
      level = 0,
      indentPx = 10,
      icon,
      label,
      right,
      children,
      className,
      ...props
    },
    ref,
  ) => {
    const textSize = sizeTextClasses[size];
    const padding = size === 'compact' ? 'py-0.5' : size === 'spacious' ? 'py-2' : 'py-1';
    const paddingLeft = level * indentPx + 2;

    return (
      <>
        <ContainerFlex
          align="center"
          gap="none"
          className="px-1 w-full"
          style={{ paddingLeft: `${paddingLeft}px` }}
        >
          <Button
            ref={ref}
            type="button"
            variant="ghost"
            className={cn(
              'w-full flex-1 justify-start gap-1.5 px-1.5 text-left',
              padding,
              textSize,
              'h-auto rounded-md transition-colors',
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
            {right && <div className="ml-auto flex-shrink-0 text-right">{right}</div>}
          </Button>
        </ContainerFlex>

        {children}
      </>
    );
  },
);
TreeItem.displayName = 'TreeItem';
