import React from 'react';
import { Heading3 } from '@renderer/components/ui/text';
import { cn } from '@renderer/lib/utils';

export interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingsSection({ title, children, className }: SettingsSectionProps) {
  return (
    <div className={cn('', className)}>
      <Heading3 className="mb-4">{title}</Heading3>
      {children}
    </div>
  );
}
