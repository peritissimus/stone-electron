import React from 'react';
import { Button } from '@renderer/components/base/ui/button';
import { Body } from '@renderer/components/base/ui/text';
import { ContainerFlex, ContainerStack } from '@renderer/components/base/ui';
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
      <ContainerFlex justify="between" align="start" gap="md">
        <ContainerStack gap="xs">
          <Body weight="medium">{title}</Body>
          <Body size="sm" variant="muted">
            {description}
          </Body>
        </ContainerStack>
        <Button
          onClick={onClick}
          disabled={loading}
          variant={variant}
          className="gap-2 flex-shrink-0"
        >
          {buttonIcon}
          {buttonText}
        </Button>
      </ContainerFlex>
    </div>
  );
}
