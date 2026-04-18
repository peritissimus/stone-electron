import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import type { FileTreeNode } from '@renderer/stores/fileTreeStore';

export type { FileTreeNode };

export function useFileTree() {
  const tree = useFileTreeStore((s) => s.tree);
  const activeFolder = useFileTreeStore((s) => s.activeFolder);
  const selectedFile = useFileTreeStore((s) => s.selectedFile);
  const expandedPaths = useFileTreeStore((s) => s.expandedPaths);
  const counts = useFileTreeStore((s) => s.counts);
  const loading = useFileTreeStore((s) => s.loading);
  const error = useFileTreeStore((s) => s.error);

  const setActiveFolder = useFileTreeStore((s) => s.setActiveFolder);
  const setSelectedFile = useFileTreeStore((s) => s.setSelectedFile);
  const toggleExpanded = useFileTreeStore((s) => s.toggleExpanded);
  const expandAll = useFileTreeStore((s) => s.expandAll);
  const collapseAll = useFileTreeStore((s) => s.collapseAll);

  return {
    tree,
    activeFolder,
    selectedFile,
    expandedPaths,
    counts,
    loading,
    error,
    setActiveFolder,
    setSelectedFile,
    toggleExpanded,
    expandAll,
    collapseAll,
  };
}
