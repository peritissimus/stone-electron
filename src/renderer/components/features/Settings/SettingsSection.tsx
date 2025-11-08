import React from 'react';
import { Heading3 } from '@renderer/components/base/ui/text';
import { ContainerStack } from '@renderer/components/base/ui';
import { cn } from '@renderer/lib/utils';

export interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingsSection({ title, children, className }: SettingsSectionProps) {
  return (
    <ContainerStack gap="md" className={className}>
      <Heading3>{title}</Heading3>
      {children}
    </ContainerStack>
  );
}
