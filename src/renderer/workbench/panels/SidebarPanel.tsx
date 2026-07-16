/**
 * SidebarPanel Component - Wrapper for sidebar content
 *
 * Implements: specs/components.ts#SidebarPanelProps
 */

import React from 'react';
import { cn } from '@renderer/lib/utils';

export interface SidebarPanelProps {
  children: React.ReactNode;
  className?: string;
}

export function SidebarPanel({ children, className }: SidebarPanelProps) {
  return <div className={cn('flex flex-col h-full bg-sidebar', className)}>{children}</div>;
}
