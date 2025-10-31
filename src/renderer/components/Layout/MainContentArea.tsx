/**
 * MainContentArea Component - Wrapper for main content area
 */

import React from 'react';
import { cn } from '@renderer/lib/utils';

export interface MainContentAreaProps {
  children: React.ReactNode;
  className?: string;
}

export function MainContentArea({ children, className }: MainContentAreaProps) {
  return <div className={cn('flex-1 flex flex-col overflow-hidden', className)}>{children}</div>;
}
