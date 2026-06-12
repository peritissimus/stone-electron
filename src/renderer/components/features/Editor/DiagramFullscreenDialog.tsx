/**
 * Diagram Fullscreen Dialog - Fullscreen view with zoom and pan
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, MagnifyingGlassPlus, MagnifyingGlassMinus, ArrowsIn, ArrowsOut } from '@phosphor-icons/react';
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from '@renderer/components/base/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@renderer/lib/utils';
import { Button } from '@renderer/components/base/ui/button';

interface DiagramFullscreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  svgContent: string;
  title?: string;
}

export const DiagramFullscreenDialog: React.FC<DiagramFullscreenDialogProps> = ({
  open,
  onOpenChange,
  svgContent,
  title = 'Diagram',
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const diagramRef = useRef<HTMLDivElement>(null);

  // Reset zoom and position when dialog opens
  useEffect(() => {
    if (open) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [open]);

  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(s + 0.25, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(s - 0.25, 0.25));
  }, []);

  const handleResetView = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleFitToView = useCallback(() => {
    if (!containerRef.current || !diagramRef.current) return;

    const container = containerRef.current.getBoundingClientRect();
    const diagram = diagramRef.current.getBoundingClientRect();

    // Calculate scale to fit diagram in container with padding
    const padding = 40;
    const scaleX = (container.width - padding * 2) / (diagram.width / scale);
    const scaleY = (container.height - padding * 2) / (diagram.height / scale);
    const newScale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%

    setScale(Math.max(0.1, newScale));
    setPosition({ x: 0, y: 0 });
  }, [scale]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((s) => Math.min(Math.max(s + delta, 0.25), 4));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDoubleClick = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-4 z-50 flex flex-col bg-background border border-border rounded-lg shadow-2xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <span className="text-sm font-medium">{title}</span>
            <div className="flex items-center gap-2">
              {/* Zoom controls */}
              <div className="flex items-center gap-1 mr-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomOut}
                  className="size-8 p-0"
                  title="Zoom out"
                >
                  <MagnifyingGlassMinus size={16} />
                </Button>
                <span className="text-xs text-muted-foreground w-12 text-center">
                  {Math.round(scale * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomIn}
                  className="size-8 p-0"
                  title="Zoom in"
                >
                  <MagnifyingGlassPlus size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFitToView}
                  className="size-8 p-0"
                  title="Fit to view"
                >
                  <ArrowsIn size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetView}
                  className="size-8 p-0"
                  title="Reset to 100%"
                >
                  <ArrowsOut size={16} />
                </Button>
              </div>
              {/* Close button */}
              <DialogPrimitive.Close className="rounded-sm opacity-70 hover:opacity-100 focus:outline-hidden">
                <X size={20} />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Diagram container */}
          <div
            ref={containerRef}
            role="application"
            aria-label="Diagram viewer — scroll to zoom, drag to pan"
            className={cn(
              'flex-1 relative bg-card/50 cursor-grab',
              isDragging && 'cursor-grabbing',
            )}
            style={{ overflow: 'hidden' }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onDoubleClick={handleDoubleClick}
          >
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ overflow: 'visible' }}
            >
              <div
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                }}
              >
                <div
                  ref={diagramRef}
                  className="mermaid-preview p-8"
                  style={{
                    minWidth: 'max-content',
                    minHeight: 'max-content',
                  }}
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              </div>
            </div>
          </div>

          {/* Footer with instructions */}
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground shrink-0">
            Scroll to zoom • Drag to pan • Double-click to reset
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
};
