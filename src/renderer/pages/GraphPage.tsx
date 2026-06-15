/**
 * GraphPage - Full page view for the note graph visualization
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { GitFork, CaretRight, CirclesThree, RadioButton } from '@phosphor-icons/react';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useNotes } from '@renderer/hooks/useNotes';
import { useSidebarUI } from '@renderer/hooks/useUI';
import { useNavigateToNote } from '@renderer/navigation';
import { Skeleton } from '@renderer/components/base/ui/skeleton';
import { IconButton, sizeHeightClasses } from '@renderer/components/composites';
import { cn } from '@renderer/lib/utils';
import { logger } from '@renderer/lib/logger';
import { NoteForceGraph } from '@renderer/components/features/Graph/NoteForceGraph';
import type { GraphData, GraphNode } from '@shared/types';

function isLinked(node: GraphNode): boolean {
  return node.type === 'note' && node.metadata.degree > 0;
}

export default function GraphPage() {
  const navigateToNote = useNavigateToNote();
  const { getGraphData } = useNoteAPI();
  const { activeNoteId } = useNotes();
  const { toggleSidebar, sidebarOpen } = useSidebarUI();
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [showOrphans, setShowOrphans] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await getGraphData();
        if (!cancelled) setGraphData(data);
      } catch (error) {
        logger.error('Failed to load graph data:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getGraphData]);

  const visibleGraphData = useMemo<GraphData>(
    () =>
      showOrphans
        ? graphData
        : {
            nodes: graphData.nodes.filter(isLinked),
            links: graphData.links,
          },
    [graphData, showOrphans],
  );

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      navigateToNote(node.id);
    },
    [navigateToNote],
  );

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
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
          <div className="size-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
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
            <span className="size-2 rounded-full bg-primary"></span>
            {visibleGraphData.nodes.length} notes
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-px bg-muted-foreground"></span>
            {visibleGraphData.links.length} links
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
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
            <NoteForceGraph
              data={visibleGraphData}
              activeNoteId={activeNoteId}
              onNodeClick={handleNodeClick}
            />
          </div>
        )}
      </div>
    </div>
  );
}
