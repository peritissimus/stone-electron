import React from 'react';
import { Button } from '@renderer/components/ui/button';
import { Body } from '@renderer/components/ui/text';
import { cn } from '@renderer/lib/utils';

export interface ActionCardProps {
  title: string;
  description: string;
  buttonText: string;
  buttonIcon?: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  variant?: 'default' | 'secondary' | 'destructive';
  className?: string;
}

export function ActionCard({
  title,
  description,
  buttonText,
  buttonIcon,
  onClick,
  loading = false,
  variant = 'default',
  className,
}: ActionCardProps) {
  return (
    <div className={cn('border border-border rounded-lg p-4', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Body weight="medium" className="mb-1">
            {title}
          </Body>
          <Body size="sm" variant="muted">
            {description}
          </Body>
        </div>
        <Button
          onClick={onClick}
          disabled={loading}
          variant={variant}
          className="ml-4 flex items-center gap-2"
        >
          {buttonIcon}
          {buttonText}
        </Button>
      </div>
    </div>
  );
}
