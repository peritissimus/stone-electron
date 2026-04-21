/**
 * GraphView Component - Visual note graph with force-directed layout
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useNotes } from '@renderer/hooks/useNotes';
import { useNavigateToNote } from '@renderer/navigation';
import { ModalLayout } from '@renderer/components/composites/layout/ModalLayout';
import { CircleNotch } from 'phosphor-react';
import { logger } from '@renderer/lib/logger';

interface GraphNode {
  id: string;
  name: string;
  val: number;
  color?: string;
  // Properties added dynamically by the force graph library
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface GraphViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GraphView({ isOpen, onClose }: GraphViewProps) {
  const { getGraphData } = useNoteAPI();
  const { activeNoteId } = useNotes();
  const navigateToNote = useNavigateToNote();
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 800, height: 550 });
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>();

  // Load graph data
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const data = await getGraphData();
        setGraphData(data);
      } catch (error) {
        logger.error('Failed to load graph data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, getGraphData]);

  // Handle container resize
  useEffect(() => {
    if (!containerRef.current || !isOpen) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [isOpen]);

  // Center graph after data loads
  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0 && !loading) {
      const timeoutId = setTimeout(() => {
        graphRef.current?.zoomToFit(400, 50);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [graphData, loading]);

  // Handle node click - navigate to note
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      navigateToNote(node.id);
      onClose();
    },
    [navigateToNote, onClose],
  );

  // Custom node rendering
  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.name || 'Untitled';
      const fontSize = 12 / globalScale;
      const isActive = node.id === activeNoteId;
      const nodeRadius = Math.sqrt(node.val || 1) * 4;

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, nodeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = isActive ? 'hsl(211, 100%, 50%)' : node.color || 'hsl(211, 80%, 60%)';
      ctx.fill();

      // Active node ring
      if (isActive) {
        ctx.strokeStyle = 'hsl(211, 100%, 70%)';
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      // Label
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isActive ? 'hsl(211, 100%, 50%)' : 'hsl(0, 0%, 40%)';
      ctx.fillText(label, node.x || 0, (node.y || 0) + nodeRadius + 2);
    },
    [activeNoteId],
  );

  // Pointer area for node clicks
  const nodePointerAreaPaint = useCallback(
    (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      const nodeRadius = Math.sqrt(node.val || 1) * 4;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, nodeRadius + 5, 0, 2 * Math.PI);
      ctx.fill();
    },
    [],
  );

  if (!isOpen) return null;

  return (
    <ModalLayout title="Note Graph" onClose={onClose} maxWidth="max-w-5xl">
      <div ref={containerRef} className="w-full h-[550px] bg-background rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <CircleNotch size={32} className="animate-spin text-primary" />
          </div>
        ) : graphData.nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p className="text-lg font-medium">No notes to display</p>
            <p className="text-sm mt-1">Create some notes and link them with [[note name]]</p>
          </div>
        ) : (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={nodePointerAreaPaint}
            onNodeClick={handleNodeClick}
            linkColor={() => 'hsl(0, 0%, 80%)'}
            linkWidth={1}
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
      <div className="mt-4 flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-primary"></span>
          Current note
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-primary/60"></span>
          {graphData.nodes.length} notes
        </span>
        <span className="flex items-center gap-2">
          <span className="w-6 h-px bg-border"></span>
          {graphData.links.length} links
        </span>
      </div>
    </ModalLayout>
  );
}
