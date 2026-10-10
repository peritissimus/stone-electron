import { useMemo } from 'react';
import {
  useFileTreeStore,
  type FileTreeNode,
} from '@renderer/services/workspace/model/fileTreeStore';
import { normalizePath } from '@renderer/lib/path';

export interface VisibleTreeItem {
  node: FileTreeNode;
  level: number;
  /** Full sibling position/count, including rows outside the rendered window. */
  positionInSet: number;
  setSize: number;
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
export function flattenVisibleTree(tree: FileTreeNode[], expanded: Set<string>): VisibleTreeItem[] {
  return flatten(tree, expanded, null, 0);
}

/** Keep keyboard focus and the virtual window on the same visible fallback. */
export function getVisibleTreeCursorIndex(
  items: readonly VisibleTreeItem[],
  cursorPath: string | null,
): number {
  if (cursorPath === null || items.length === 0) return -1;
  const index = items.findIndex((item) => item.path === cursorPath);
  if (index >= 0) return index;

  let fallback = 0;
  items.forEach((item, itemIndex) => {
    if (item.type === 'folder' && (item.path === '' || cursorPath.startsWith(`${item.path}/`))) {
      fallback = itemIndex;
    }
  });
  return fallback;
}

/**
 * Pre-order flatten of the file tree restricted to currently visible nodes.
 * Cheap: O(n) over visible count, recomputed only when tree or
 * expandedPaths change.
 */
export function useVisibleTreeItems(): VisibleTreeItem[] {
  const tree = useFileTreeStore((s) => s.tree);
  const expandedPaths = useFileTreeStore((s) => s.expandedPaths);

  return useMemo(() => flatten(tree, expandedPaths, null, 0), [tree, expandedPaths]);
}

function flatten(
  nodes: FileTreeNode[],
  expanded: Set<string>,
  parentPath: string | null,
  level: number,
): VisibleTreeItem[] {
  const out: VisibleTreeItem[] = [];
  for (const [index, node] of nodes.entries()) {
    const path = normalizePath(node.path);
    const siblings = { positionInSet: index + 1, setSize: nodes.length };
    if (node.type === 'folder') {
      const isExpanded = expanded.has(path);
      out.push({ node, level, path, ...siblings, type: 'folder', parentPath, isExpanded });
      if (isExpanded && node.children && node.children.length > 0) {
        out.push(...flatten(node.children, expanded, path, level + 1));
      }
    } else {
      out.push({ node, level, path, ...siblings, type: 'file', parentPath });
    }
  }
  return out;
}
