/**
 * GraphPage - Full page view for the note graph visualization
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { GitFork, CaretRight, CirclesThree, RadioButton } from 'phosphor-react';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useNotes } from '@renderer/hooks/useNotes';
import { useSidebarUI } from '@renderer/hooks/useUI';
import { useNavigateToNote } from '@renderer/navigation';
import { Skeleton } from '@renderer/components/base/ui/skeleton';
import { IconButton, sizeHeightClasses } from '@renderer/components/composites';
import { cn } from '@renderer/lib/utils';
import { logger } from '@renderer/lib/logger';

interface GraphNode {
  id: string;
  label: string;
  type: 'note' | 'notebook' | 'tag' | 'topic';
  metadata?: Record<string, unknown>;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
  type: 'link' | 'reference' | 'tag' | 'topic' | 'parent';
  weight?: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function GraphPage() {
  const navigateToNote = useNavigateToNote();
  const { getGraphData } = useNoteAPI();
  const { activeNoteId } = useNotes();
  const { toggleSidebar, sidebarOpen } = useSidebarUI();
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [showOrphans, setShowOrphans] = useState(true);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>();

  // Load graph data
  useEffect(() => {
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
  }, [getGraphData]);

  const visibleGraphData = useMemo(
    () =>
      showOrphans
        ? graphData
        : {
            nodes: graphData.nodes.filter((node) => Number(node.metadata?.degree ?? 0) > 0),
            links: graphData.links,
          },
    [graphData, showOrphans],
  );

  // Handle container resize
  useEffect(() => {
    if (!containerRef.current) return;

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
  }, []);

  // Center graph after data loads
  useEffect(() => {
    if (graphRef.current && visibleGraphData.nodes.length > 0 && !loading) {
      const timeoutId = setTimeout(() => {
        graphRef.current?.zoomToFit(400, 50);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [visibleGraphData, loading]);

  // Handle node click - navigate to note
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      navigateToNote(node.id);
    },
    [navigateToNote],
  );

  // Custom node rendering
  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.label || 'Untitled';
      const fontSize = 12 / globalScale;
      const isActive = node.id === activeNoteId;
      const degree = Number(node.metadata?.degree ?? 0);
      const nodeRadius = Math.sqrt(Math.max(degree, 1)) * 4;

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, nodeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = isActive
        ? 'hsl(211, 100%, 50%)'
        : degree > 0
          ? 'hsl(168, 72%, 38%)'
          : 'hsl(225, 12%, 68%)';
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
      const degree = Number(node.metadata?.degree ?? 0);
      const nodeRadius = Math.sqrt(Math.max(degree, 1)) * 4;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, nodeRadius + 5, 0, 2 * Math.PI);
      ctx.fill();
    },
    [],
  );

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div
          className={cn(
            'px-4 border-b border-border shrink-0 bg-card flex items-center gap-3',
            sizeHeightClasses['spacious'],
          )}
        >
          {!sidebarOpen && (
            <IconButton
              size="normal"
              icon={<CaretRight size={16} weight="bold" />}
              tooltip="Expand sidebar"
              onClick={toggleSidebar}
            />
          )}
          <GitFork size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium">Graph</span>
          <div className="flex-1" />
          <Skeleton className="w-24 h-4 rounded" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className={cn(
          'px-4 border-b border-border shrink-0 bg-card flex items-center gap-3',
          sizeHeightClasses['spacious'],
        )}
      >
        {!sidebarOpen && (
          <IconButton
            size="normal"
            icon={<CaretRight size={16} weight="bold" />}
            tooltip="Expand sidebar"
            onClick={toggleSidebar}
          />
        )}
        <GitFork size={16} className="text-muted-foreground" />
        <span className="text-sm font-medium">Graph</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowOrphans((value) => !value)}
          className={cn(
            'inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs transition-colors',
            showOrphans
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border bg-background text-muted-foreground hover:text-foreground',
          )}
        >
          <CirclesThree size={14} />
          {showOrphans ? 'All notes' : 'Linked only'}
        </button>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            {visibleGraphData.nodes.length} notes
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-px bg-muted-foreground"></span>
            {visibleGraphData.links.length} links
          </span>
        </div>
      </div>

      {/* Graph Canvas */}
      <div ref={containerRef} className="flex-1 overflow-hidden">
        {visibleGraphData.nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <GitFork size={48} className="text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium">No notes to display</p>
            <p className="text-sm mt-1">Create some notes and link them with [[note name]]</p>
          </div>
        ) : (
          <div className="relative h-full">
            {visibleGraphData.links.length === 0 && (
              <div className="absolute left-4 top-4 z-[1] flex items-center gap-2 rounded-md border border-border bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
                <RadioButton size={14} />
                Notes are shown as a constellation until links are added.
              </div>
            )}
            <ForceGraph2D
              ref={graphRef}
              graphData={visibleGraphData}
              width={dimensions.width}
              height={dimensions.height}
              nodeCanvasObject={nodeCanvasObject}
              nodePointerAreaPaint={nodePointerAreaPaint}
              onNodeClick={handleNodeClick}
              linkColor={() => 'hsl(168, 40%, 58%)'}
              linkWidth={(link: GraphLink) => Math.max(link.weight ?? 1, 1)}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              cooldownTicks={100}
              onEngineStop={() => graphRef.current?.zoomToFit(400, 50)}
              enableNodeDrag={true}
              enableZoomInteraction={true}
              enablePanInteraction={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}
