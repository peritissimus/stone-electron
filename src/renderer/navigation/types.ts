import type { ReactNode } from 'react';

export type NavSection = 'primary';

export interface NavDescriptor {
  id: string;
  path: string;
  label: string;
  icon: ReactNode;
  isActive: (pathname: string) => boolean;
  section: NavSection;
}
