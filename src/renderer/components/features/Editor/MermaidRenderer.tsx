/**
 * Mermaid Renderer - Renders Mermaid and FlowDSL diagrams
 */

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@renderer/lib/utils';
import { renderMermaidDiagram } from '@renderer/lib/mermaid';
import { convertFlowDSLToMermaid } from '@renderer/lib/flowdsl-parser';
import { logger } from '@renderer/utils/logger';
import { DiagramFullscreenDialog } from './DiagramFullscreenDialog';
import { encodeToBase64 } from '@renderer/utils/base64';

interface EditingState {
  nodeId: string;
  label: string;
  x: number;
  y: number;
  width: number;
}

interface MermaidRendererProps {
  code: string;
  language: 'mermaid' | 'flowdsl';
  isDarkMode: boolean;
  onEditCode: () => void;
  onUpdateSource?: (nodeId: string, oldLabel: string, newLabel: string) => void;
  isFullscreen?: boolean;
  onFullscreenChange?: (open: boolean) => void;
}

export const MermaidRenderer: React.FC<MermaidRendererProps> = ({
  code,
  language,
  isDarkMode,
  onEditCode,
  onUpdateSource,
  isFullscreen = false,
  onFullscreenChange,
}) => {
  const [renderedSvg, setRenderedSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [editingReady, setEditingReady] = useState(false);
  const diagramRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const isFlowDSL = language === 'flowdsl';
  const isStateDiagram = /(^|\n)\s*stateDiagram(-v2)?/i.test(code);

  // Render diagram
  useEffect(() => {
    if (!code.trim()) {
      setRenderedSvg('');
      setError(null);
      return;
    }

    const renderDiagram = async () => {
      try {
        setError(null);

        // Convert FlowDSL to Mermaid if needed
        let mermaidCode = code;
        if (isFlowDSL) {
          try {
            mermaidCode = convertFlowDSLToMermaid(code);
          } catch (parseErr: any) {
            setError(parseErr.message || 'Failed to parse FlowDSL');
            return;
          }
        }

        setIsRendering(true);

        const result = await renderMermaidDiagram(mermaidCode, isDarkMode, isStateDiagram);

        if (result.error) {
          setError(result.error);
        } else {
          setRenderedSvg(result.svg);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to render diagram');
        logger.error('Diagram render error:', err);
      } finally {
        setIsRendering(false);
      }
    };

    // Debounce rendering
    const timeoutId = setTimeout(renderDiagram, 300);
    return () => clearTimeout(timeoutId);
  }, [code, isDarkMode, isFlowDSL, isStateDiagram]);

  // Focus input when editing starts
  useEffect(() => {
    if (editing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
      const timeout = setTimeout(() => setEditingReady(true), 100);
      return () => clearTimeout(timeout);
    } else {
      setEditingReady(false);
    }
  }, [editing]);

  // Handle double-click on diagram to edit node labels
  const handleDiagramDoubleClick = (e: React.MouseEvent) => {
    if (!diagramRef.current || !onUpdateSource) return;

    const target = e.target as Element;
    const nodeGroup = target.closest('.node');
    if (!nodeGroup) return;

    const nodeId = nodeGroup.id || '';
    const nodeIdMatch = nodeId.match(/flowchart-(\w+)-\d+/);
    const extractedId = nodeIdMatch ? nodeIdMatch[1] : '';

    // Find the label text
    let labelText = '';
    const nodeLabelElement = nodeGroup.querySelector('.nodeLabel');
    if (nodeLabelElement) {
      labelText = nodeLabelElement.textContent?.trim() || '';
    }
    if (!labelText) {
      const textElement = nodeGroup.querySelector('text');
      if (textElement) {
        labelText = textElement.textContent?.trim() || '';
      }
    }
    if (!labelText) {
      const foreignDiv = nodeGroup.querySelector('foreignObject div');
      if (foreignDiv) {
        labelText = foreignDiv.textContent?.trim() || '';
      }
    }

    if (!labelText) return;

    // Get position relative to diagram container
    const containerRect = diagramRef.current.getBoundingClientRect();
    const nodeRect = nodeGroup.getBoundingClientRect();
    const parentContainer = diagramRef.current.parentElement;
    const parentRect = parentContainer?.getBoundingClientRect() || containerRect;

    const x = nodeRect.left - parentRect.left + nodeRect.width / 2;
    const y = nodeRect.top - parentRect.top + nodeRect.height / 2;
    const width = Math.max(nodeRect.width - 10, 120);

    setEditing({
      nodeId: extractedId || labelText.toLowerCase().replace(/\s+/g, '_'),
      label: labelText,
      x,
      y,
      width,
    });
  };

  const handleEditComplete = (newLabel: string) => {
    if (editing && onUpdateSource) {
      if (newLabel.trim() && newLabel !== editing.label) {
        onUpdateSource(editing.nodeId, editing.label, newLabel);
      }
      setEditing(null);
    }
  };

  const handleEditCancel = () => {
    setEditing(null);
  };

  useEffect(() => {
    if (!diagramRef.current) return;
    if (renderedSvg) {
      diagramRef.current.setAttribute('data-mermaid-svg', encodeToBase64(renderedSvg));
    } else {
      diagramRef.current.removeAttribute('data-mermaid-svg');
    }
  }, [renderedSvg]);

  if (isRendering) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="text-sm text-muted-foreground">Rendering diagram...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20">
        <p className="text-sm font-medium text-destructive">
          {isFlowDSL ? 'FlowDSL Error' : 'Mermaid Error'}
        </p>
        <p className="text-xs text-destructive/80 mt-1 font-mono">{error}</p>
        <button
          type="button"
          onClick={onEditCode}
          className="mt-3 text-xs text-destructive underline hover:no-underline"
        >
          Edit code to fix
        </button>
      </div>
    );
  }

  if (!renderedSvg) {
    return (
      <div className="flex justify-center items-center min-h-[100px]">
        <div className="text-sm text-muted-foreground">
          {isFlowDSL
            ? 'Start typing FlowDSL syntax to see the diagram...'
            : 'Start typing Mermaid syntax to see the diagram...'}
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={diagramRef}
        contentEditable={false}
        suppressContentEditableWarning
        className={cn(
          'flex justify-center items-center min-h-[100px] mermaid-preview relative select-none w-full',
          isStateDiagram && 'mermaid-state-diagram',
          '[&>svg]:max-w-full [&>svg]:h-auto',
        )}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleDiagramDoubleClick(e);
        }}
        dangerouslySetInnerHTML={{ __html: renderedSvg }}
      />

      {/* Fullscreen dialog */}
      {onFullscreenChange && (
        <DiagramFullscreenDialog
          open={isFullscreen}
          onOpenChange={onFullscreenChange}
          svgContent={renderedSvg}
          title={isFlowDSL ? 'FlowDSL Diagram' : 'Mermaid Diagram'}
        />
      )}

      {/* Inline edit overlay */}
      {editing && (
        <div
          className="absolute z-50 rounded-xl"
          style={{
            left: editing.x,
            top: editing.y,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 0 3px hsl(var(--primary)), 0 10px 40px rgba(0,0,0,0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            ref={editInputRef}
            type="text"
            defaultValue={editing.label}
            className={cn(
              'px-4 py-2.5 text-sm rounded-xl border-0',
              'text-foreground bg-overlay',
              'focus:outline-none',
              'text-center font-medium',
            )}
            style={{
              width: editing.width,
              minWidth: 140,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                handleEditComplete((e.target as HTMLInputElement).value);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                handleEditCancel();
              }
            }}
            onBlur={(e) => {
              if (editingReady) {
                handleEditComplete(e.target.value);
              }
            }}
          />
        </div>
      )}
    </>
  );
};
