import { Body, Text } from '@renderer/components/ui/text';

interface StatusItem {
  label: string;
  value: string | number;
}

interface StatusCardProps {
  title?: string;
  items: StatusItem[];
  className?: string;
}

export function StatusCard({ title, items, className = '' }: StatusCardProps) {
  return (
    <div className={`bg-muted/50 rounded-lg p-4 ${className}`}>
      {title && (
        <Body weight="medium" className="mb-3">
          {title}
        </Body>
      )}
      <div className="grid grid-cols-2 gap-4">
        {items.map((item, index) => (
          <div key={index}>
            <Text size="sm" variant="muted" as="span">
              {item.label}:
            </Text>
            <Text size="sm" weight="medium" as="span" className="ml-2">
              {item.value}
            </Text>
          </div>
        ))}
      </div>
    </div>
  );
}
