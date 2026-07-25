import { useEffect, useMemo } from 'react';
import type { GraphData, GraphNode } from '@shared/types';
import { useGraphStore } from '@renderer/features/graph/model/graphStore';
import { useInvalidation } from '@renderer/services/invalidation/hooks/useInvalidation';
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

  useEffect(() => {
    void ensureLoaded();
  }, [activeWorkspaceId, ensureLoaded]);

  useInvalidation({
    sources: ['note', 'file'],
    debounceMs: 500,
    invalidate: () => refresh(false),
  });

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
