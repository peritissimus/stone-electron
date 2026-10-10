import { useFileTreeStore } from '@renderer/services/workspace/model/fileTreeStore';
import type { FileTreeNode } from '@renderer/services/workspace/model/fileTreeStore';
import { useTreeSelection } from '@renderer/services/workspace/hooks/useTreeSelection';
import { useNoteStore } from '@renderer/features/notes/model/noteStore';
import { useActiveNoteId } from '@renderer/services/navigation';
import { normalizePath } from '@renderer/lib/path';

export type { FileTreeNode };

export function useFileTreeNodes() {
  return useFileTreeStore((state) => state.tree);
}

export function useFileTreeFolder(path: string) {
  const isExpanded = useFileTreeStore((state) => state.expandedPaths.has(path));
  const toggleExpanded = useFileTreeStore((state) => state.toggleExpanded);
  const activeNoteId = useActiveNoteId();
  const isActive = useNoteStore((state) => {
    const filePath = state.notes.find((note) => note.id === activeNoteId)?.filePath;
    const normalized = filePath ? normalizePath(filePath) : '';
    const separator = normalized.lastIndexOf('/');
    return (separator > 0 ? normalized.slice(0, separator) : '') === path;
  });
  return { isExpanded, isActive, toggleExpanded };
}

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
