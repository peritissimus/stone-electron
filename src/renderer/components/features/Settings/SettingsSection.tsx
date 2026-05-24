/**
 * SettingsSection Component - Settings group with title
 *
 * Implements: specs/components.ts#SettingsSectionProps
 */

import React from 'react';
import { ContainerStack } from '@renderer/components/base/ui';
import { cn } from '@renderer/lib/utils';

export type SettingsSectionVariant = 'primary' | 'sub';

export interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  /**
   * `primary` (default) is the page-level title used at the top of each
   * settings panel. `sub` renders a smaller heading without a divider for
   * grouped subsections inside a primary section (e.g. performance categories).
   */
  variant?: SettingsSectionVariant;
}

export function SettingsSection({
  title,
  description,
  children,
  className,
  action,
  variant = 'primary',
}: SettingsSectionProps) {
  if (variant === 'sub') {
    return (
      <ContainerStack gap="md" className={className}>
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
        {children}
      </ContainerStack>
    );
  }

  return (
    <ContainerStack gap="lg" className={className}>
      <header
        className={cn(
          'flex items-start justify-between gap-4 border-b border-border/60 pb-3',
        )}
      >
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-foreground text-balance">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground text-pretty">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children}
    </ContainerStack>
  );
}
