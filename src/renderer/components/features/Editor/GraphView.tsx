/**
 * GraphView Component - Visual note graph in a modal sheet.
 *
 * Thin wrapper around <NoteForceGraph> with modal chrome + close-on-click.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useNotes } from '@renderer/hooks/useNotes';
import { useNavigateToNote } from '@renderer/navigation';
import { ModalLayout } from '@renderer/components/composites/layout/ModalLayout';
import { CircleNotch } from 'phosphor-react';
import { logger } from '@renderer/lib/logger';
import { NoteForceGraph } from '@renderer/components/features/Graph/NoteForceGraph';
import type { GraphData, GraphNode } from '@shared/types';

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

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, getGraphData]);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      navigateToNote(node.id);
      onClose();
    },
    [navigateToNote, onClose],
  );

  if (!isOpen) return null;

  return (
    <ModalLayout title="Note Graph" onClose={onClose} maxWidth="max-w-5xl">
      <div className="w-full h-[550px] bg-background rounded-lg overflow-hidden">
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
          <NoteForceGraph
            data={graphData}
            activeNoteId={activeNoteId}
            onNodeClick={handleNodeClick}
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
