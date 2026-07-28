/**
 * GraphPage - Full page view for the note graph visualization
 */

import { useCallback } from 'react';
import { GitFork, CirclesThree, RadioButton } from '@phosphor-icons/react';
import { useNotes } from '@renderer/features/notes/hooks/useNotes';
import { useGraph } from '@renderer/features/graph/hooks/useGraph';
import { useNavigateToNote } from '@renderer/services/navigation';
import { Skeleton } from '@renderer/components/base/ui/skeleton';
import { ViewHeader } from '@renderer/components/composites';
import { cn } from '@renderer/lib/utils';
import { NoteForceGraph } from '@renderer/features/graph/views/components/NoteForceGraph';
import type { GraphNode } from '@shared/types';

export default function GraphView() {
  const navigateToNote = useNavigateToNote();
  const { activeNoteId } = useNotes();
  const { data: visibleGraphData, showOrphans, toggleOrphans, loading } = useGraph();

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      navigateToNote(node.id);
    },
    [navigateToNote],
  );

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <ViewHeader title="Graph" actions={<Skeleton className="h-4 w-24 rounded" />} />
        <div className="flex-1 flex items-center justify-center">
          <div className="size-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ViewHeader
        title="Graph"
        meta={`${visibleGraphData.nodes.length} notes · ${visibleGraphData.links.length} links`}
        actions={
          <button
            type="button"
            onClick={toggleOrphans}
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
        }
      />

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
