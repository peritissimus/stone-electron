/**
 * SettingsSection Component - Settings group with title
 *
 * Implements: specs/components.ts#SettingsSectionProps
 */

import React from 'react';
import { Heading3 } from '@renderer/components/base/ui/text';
import { ContainerStack } from '@renderer/components/base/ui';

export interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function SettingsSection({ title, children, className, action }: SettingsSectionProps) {
  return (
    <ContainerStack gap="md" className={className}>
      <div className="flex items-center justify-between">
        <Heading3>{title}</Heading3>
        {action}
      </div>
      {children}
    </ContainerStack>
  );
}
