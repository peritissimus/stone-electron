/**
 * ResizablePanel Component - Handles drag-to-resize functionality
 *
 * Implements: specs/components.ts#ResizablePanelProps
 */

import React, { useRef, useCallback } from 'react';
import { cn } from '@renderer/lib/utils';

const KEYBOARD_RESIZE_STEP = 16;

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const delta = e.key === 'ArrowLeft' ? -KEYBOARD_RESIZE_STEP : KEYBOARD_RESIZE_STEP;
      onWidthChange(Math.max(minWidth, Math.min(maxWidth, width + delta)));
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
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        aria-valuenow={width}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        tabIndex={0}
        className={cn(
          'w-1 cursor-col-resize bg-transparent hover:bg-primary transition-colors',
          'outline-none focus-visible:bg-primary',
          resizerClassName,
        )}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
      />
    </>
  );
}
