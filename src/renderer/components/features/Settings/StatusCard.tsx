import { Body, Text } from '@renderer/components/base/ui/text';
import { ContainerStack, ContainerGrid, ContainerFlex } from '@renderer/components/base/ui';
import { cn } from '@renderer/lib/utils';

export interface StatusItem {
  label: string;
  value: string | number;
}

export interface StatusCardProps {
  title?: string;
  items: StatusItem[];
  className?: string;
}

export function StatusCard({ title, items, className }: StatusCardProps) {
  return (
    <div className={cn('bg-muted/50 rounded-lg p-4', className)}>
      <ContainerStack gap="md">
        {title && <Body weight="medium">{title}</Body>}
        <ContainerGrid cols={2} gap="md">
          {items.map((item, index) => (
            <ContainerFlex key={index} gap="xs" align="baseline">
              <Text size="sm" variant="muted" as="span">
                {item.label}:
              </Text>
              <Text size="sm" weight="medium" as="span">
                {item.value}
              </Text>
            </ContainerFlex>
          ))}
        </ContainerGrid>
      </ContainerStack>
    </div>
  );
}
