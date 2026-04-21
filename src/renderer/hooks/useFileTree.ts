import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import type { FileTreeNode } from '@renderer/stores/fileTreeStore';
import { useTreeSelection } from '@renderer/hooks/useTreeSelection';

export type { FileTreeNode };

export function useFileTree() {
  const tree = useFileTreeStore((s) => s.tree);
  const expandedPaths = useFileTreeStore((s) => s.expandedPaths);
  const counts = useFileTreeStore((s) => s.counts);
  const loading = useFileTreeStore((s) => s.loading);
  const error = useFileTreeStore((s) => s.error);

  const toggleExpanded = useFileTreeStore((s) => s.toggleExpanded);
  const expandAll = useFileTreeStore((s) => s.expandAll);
  const collapseAll = useFileTreeStore((s) => s.collapseAll);

  // Selection is DERIVED from the route. It is not store state.
  const { selectedFile, activeFolder } = useTreeSelection();

  return {
    tree,
    activeFolder,
    selectedFile,
    expandedPaths,
    counts,
    loading,
    error,
    toggleExpanded,
    expandAll,
    collapseAll,
  };
}
