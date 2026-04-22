import { useMemo } from 'react';
import { useFileTreeStore, type FileTreeNode } from '@renderer/stores/fileTreeStore';
import { normalizePath } from '@renderer/lib/path';

export interface VisibleTreeItem {
  path: string;
  type: 'file' | 'folder';
  parentPath: string | null;
  /** Expansion state for folders; undefined for files. */
  isExpanded?: boolean;
}

/**
 * Pure pre-order flatten of the file tree restricted to currently visible
 * nodes. Unexpanded folders hide their children. Exported for unit tests —
 * `useVisibleTreeItems` is the React binding.
 */
export function flattenVisibleTree(
  tree: FileTreeNode[],
  expanded: Set<string>,
): VisibleTreeItem[] {
  return flatten(tree, expanded, null);
}

/**
 * Pre-order flatten of the file tree restricted to currently visible nodes.
 * Cheap: O(n) over visible count, recomputed only when tree or
 * expandedPaths change.
 */
export function useVisibleTreeItems(): VisibleTreeItem[] {
  const tree = useFileTreeStore((s) => s.tree);
  const expandedPaths = useFileTreeStore((s) => s.expandedPaths);

  return useMemo(() => flatten(tree, expandedPaths, null), [tree, expandedPaths]);
}

function flatten(
  nodes: FileTreeNode[],
  expanded: Set<string>,
  parentPath: string | null,
): VisibleTreeItem[] {
  const out: VisibleTreeItem[] = [];
  for (const node of nodes) {
    const path = normalizePath(node.path);
    if (node.type === 'folder') {
      const isExpanded = expanded.has(path);
      out.push({ path, type: 'folder', parentPath, isExpanded });
      if (isExpanded && node.children && node.children.length > 0) {
        out.push(...flatten(node.children, expanded, path));
      }
    } else {
      out.push({ path, type: 'file', parentPath });
    }
  }
  return out;
}
