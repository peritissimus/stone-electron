/**
 * MainContentArea Component - Wrapper for main content area
 *
 * Implements: specs/components.ts#MainContentAreaProps
 */

import React from 'react';
import { cn } from '@renderer/lib/utils';

export interface MainContentAreaProps {
  children: React.ReactNode;
  className?: string;
}

export function MainContentArea({ children, className }: MainContentAreaProps) {
  return (
    <div className={cn('flex-1 flex flex-col overflow-hidden min-h-0', className)}>{children}</div>
  );
}
