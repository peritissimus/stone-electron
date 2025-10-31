import { CheckCircle, WarningCircle } from 'phosphor-react';

interface MessageProps {
  type: 'success' | 'error';
  text: string;
  className?: string;
}

export function Message({ type, text, className = '' }: MessageProps) {
  return (
    <div
      className={`p-4 rounded-lg flex items-start gap-3 ${
        type === 'success'
          ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400'
          : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'
      } ${className}`}
    >
      {type === 'success' ? <CheckCircle size={20} /> : <WarningCircle size={20} />}
      <span>{text}</span>
    </div>
  );
}
