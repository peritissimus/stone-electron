import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { GraphData, GraphNode } from '@shared/types';
import { useGraphStore } from '@renderer/features/graph/model/graphStore';
import { useNoteEvents } from '@renderer/features/notes/hooks/useNoteEvents';
import { useFileEvents } from '@renderer/services/workspace/hooks/useFileEvents';
import { useWorkspaceStore } from '@renderer/services/workspace/model/workspaceStore';

function isLinked(node: GraphNode): boolean {
  return node.type === 'note' && node.metadata.degree > 0;
}

export function useGraph() {
  const data = useGraphStore((state) => state.data);
  const loading = useGraphStore((state) => state.loading);
  const showOrphans = useGraphStore((state) => state.showOrphans);
  const setShowOrphans = useGraphStore((state) => state.setShowOrphans);
  const ensureLoaded = useGraphStore((state) => state.ensureLoaded);
  const refresh = useGraphStore((state) => state.refresh);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void ensureLoaded();
  }, [activeWorkspaceId, ensureLoaded]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => void refresh(false), 500);
  }, [refresh]);

  useEffect(
    () => () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    },
    [],
  );

  useNoteEvents({
    onCreated: scheduleRefresh,
    onUpdated: scheduleRefresh,
    onDeleted: scheduleRefresh,
  });
  useFileEvents({ onChanged: scheduleRefresh });

  const visibleData = useMemo<GraphData>(
    () =>
      showOrphans
        ? data
        : {
            nodes: data.nodes.filter(isLinked),
            links: data.links,
          },
    [data, showOrphans],
  );

  return {
    data: visibleData,
    loading,
    showOrphans,
    toggleOrphans: () => setShowOrphans(!showOrphans),
  };
}
