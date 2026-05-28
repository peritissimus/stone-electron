/**
 * ResizablePanel Component - Handles drag-to-resize functionality
 *
 * Implements: specs/components.ts#ResizablePanelProps
 */

import React, { useRef, useCallback } from 'react';
import { cn } from '@renderer/lib/utils';

export interface ResizablePanelProps {
  children: React.ReactNode;
  width: number;
  minWidth?: number;
  maxWidth?: number;
  onWidthChange: (width: number) => void;
  className?: string;
  resizerClassName?: string;
}

export function ResizablePanel({
  children,
  width,
  minWidth = 200,
  maxWidth = 600,
  onWidthChange,
  className,
  resizerClassName,
}: ResizablePanelProps) {
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = width;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizingRef.current) return;

        const delta = e.clientX - startXRef.current;
        const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + delta));
        onWidthChange(newWidth);
      };

      const handleMouseUp = () => {
        isResizingRef.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [width, minWidth, maxWidth, onWidthChange],
  );

  return (
    <>
      <div className={cn('flex-shrink-0', className)} style={{ width: `${width}px` }}>
        {children}
      </div>

      {/* Resizer */}
      <div
        className={cn(
          'w-1 cursor-col-resize bg-transparent hover:bg-primary transition-colors',
          resizerClassName,
        )}
        onMouseDown={handleMouseDown}
      />
    </>
  );
}
