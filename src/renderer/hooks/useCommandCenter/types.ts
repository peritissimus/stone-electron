import type { ReactNode } from 'react';

export interface CommandItem {
  id: string;
  type: 'command' | 'note';
  title: string;
  subtitle?: string;
  icon: ReactNode;
  shortcut?: string;
  score?: number;
  isRecent?: boolean;
  action: () => void;
}
