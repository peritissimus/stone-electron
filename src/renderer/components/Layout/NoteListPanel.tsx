/**
 * NoteListPanel Component - Wrapper for note list content
 */

import React from 'react';
import { cn } from '@renderer/lib/utils';

interface NoteListPanelProps {
  children: React.ReactNode;
  className?: string;
}

export function NoteListPanel({ children, className }: NoteListPanelProps) {
  return <div className={cn('flex flex-col h-full bg-secondary', className)}>{children}</div>;
}
