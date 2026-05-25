/**
 * NoteForceGraph — shared force-directed canvas for the note graph.
 *
 * Both the editor sheet (`GraphView`) and the full Graph page render this
 * to avoid the canvas painters / config drifting apart again. Callers
 * own layout, data fetching, and any UI chrome around the canvas.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { GraphData, GraphLink, GraphNode } from '@shared/types';

// Force-graph mutates nodes with x/y during layout; declare them here so
// the canvas painters can read them without an `as` cast.
type LaidOutNode = GraphNode & { x?: number; y?: number };

interface NoteForceGraphProps {
  data: GraphData;
  activeNoteId: string | null;
  onNodeClick: (node: GraphNode) => void;
}

const LINK_COLOR = 'hsl(168, 40%, 58%)';
const LINK_WIDTH = (link: GraphLink): number => link.weight ?? 1;
const linkColor = (): string => LINK_COLOR;

function radiusOf(node: GraphNode): number {
  const degree = node.type === 'note' ? node.metadata.degree : 0;
  return Math.sqrt(Math.max(degree, 1)) * 4;
}

export function NoteForceGraph({ data, activeNoteId, onNodeClick }: NoteForceGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // react-force-graph's ref type is not exported; `any` is the library convention.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Auto-zoom after the layout settles. Re-runs whenever the dataset changes.
  useEffect(() => {
    if (!graphRef.current || data.nodes.length === 0) return;
    const id = setTimeout(() => graphRef.current?.zoomToFit(400, 50), 100);
    return () => clearTimeout(id);
  }, [data]);

  const nodeCanvasObject = useCallback(
    (node: LaidOutNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.label || 'Untitled';
      const fontSize = 12 / globalScale;
      const isActive = node.id === activeNoteId;
      const degree = node.type === 'note' ? node.metadata.degree : 0;
      const nodeRadius = radiusOf(node);

      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, nodeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = isActive
        ? 'hsl(211, 100%, 50%)'
        : degree > 0
          ? 'hsl(168, 72%, 38%)'
          : 'hsl(225, 12%, 68%)';
      ctx.fill();

      if (isActive) {
        ctx.strokeStyle = 'hsl(211, 100%, 70%)';
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isActive ? 'hsl(211, 100%, 50%)' : 'hsl(0, 0%, 40%)';
      ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + nodeRadius + 2);
    },
    [activeNoteId],
  );

  const nodePointerAreaPaint = useCallback(
    (node: LaidOutNode, color: string, ctx: CanvasRenderingContext2D) => {
      const nodeRadius = radiusOf(node);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, nodeRadius + 5, 0, 2 * Math.PI);
      ctx.fill();
    },
    [],
  );

  return (
    <div ref={containerRef} className="w-full h-full">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ForceGraph2D
          ref={graphRef}
          graphData={data}
          width={dimensions.width}
          height={dimensions.height}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={nodePointerAreaPaint}
          onNodeClick={onNodeClick}
          linkColor={linkColor}
          linkWidth={LINK_WIDTH}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          cooldownTicks={100}
          onEngineStop={() => graphRef.current?.zoomToFit(400, 50)}
          enableNodeDrag={true}
          enableZoomInteraction={true}
          enablePanInteraction={true}
        />
      )}
    </div>
  );
}
