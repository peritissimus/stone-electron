import { CheckCircle, WarningCircle } from 'phosphor-react';
import { Text } from '@renderer/components/ui/text';
import { ContainerFlex } from '@renderer/components/ui';
import { cn } from '@renderer/lib/utils';

export interface MessageProps {
  type: 'success' | 'error';
  text: string;
  className?: string;
}

export function Message({ type, text, className }: MessageProps) {
  return (
    <div
      className={cn(
        'p-4 rounded-lg',
        type === 'success'
          ? 'bg-green-50 dark:bg-green-900/20'
          : 'bg-red-50 dark:bg-red-900/20',
        className,
      )}
    >
      <ContainerFlex gap="sm" align="start">
        <div className={type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
          {type === 'success' ? <CheckCircle size={20} /> : <WarningCircle size={20} />}
        </div>
        <Text
          size="sm"
          as="span"
          className={type === 'success' ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}
        >
          {text}
        </Text>
      </ContainerFlex>
    </div>
  );
}
