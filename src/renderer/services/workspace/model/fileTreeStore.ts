/**
 * File Tree Store - structure + expansion state only.
 *
 * Selection (selectedFile, activeFolder) is NOT stored here. It is derived
 * from the active route via useTreeSelection(). Consumers that need the
 * current file/folder should read them from that hook, not from this store.
 */

import { create } from 'zustand';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  children?: FileTreeNode[];
}

interface FileTreeState {
  tree: FileTreeNode[];
  expandedPaths: Set<string>;
  allFolderPaths: Set<string>; // Cached for O(1) expandAll
  loading: boolean;
  error: string | null;
  counts: Record<string, number>;

  // Actions
  setTree: (tree: FileTreeNode[]) => void;
  toggleExpanded: (path: string) => void;
  /** Expand every ancestor folder of the given file or folder path. */
  expandPath: (path: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCounts: (counts: Record<string, number>) => void;
  updateFileInTree: (relativePath: string, update: Partial<FileTreeNode>) => void;
  addFileToTree: (relativePath: string, node: FileTreeNode) => void;
  removeFileFromTree: (relativePath: string) => void;
}

// Helper to collect all folder paths from tree (used once when tree is set)
function collectFolderPaths(nodes: FileTreeNode[], acc: Set<string> = new Set()): Set<string> {
  for (const node of nodes) {
    if (node.type === 'folder') {
      acc.add(node.path);
      if (node.children && node.children.length > 0) {
        collectFolderPaths(node.children, acc);
      }
    }
  }
  return acc;
}

function normalizeForExpansion(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

export const useFileTreeStore = create<FileTreeState>((set, _get) => ({
  tree: [],
  expandedPaths: new Set(),
  allFolderPaths: new Set(),
  loading: false,
  error: null,
  counts: {},

  setTree: (tree) => {
    // Pre-compute all folder paths for O(1) expandAll
    const allFolderPaths = collectFolderPaths(tree);
    set({ tree, allFolderPaths });
  },

  toggleExpanded: (path) =>
    set((state) => {
      const next = new Set(state.expandedPaths);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return { expandedPaths: next };
    }),

  expandPath: (path) =>
    set((state) => {
      const normalized = normalizeForExpansion(path);
      if (!normalized) return state;
      const next = new Set(state.expandedPaths);
      const segments = normalized.split('/');
      // Expand every ancestor, excluding the leaf (file or leaf folder is
      // controlled by the user's explicit clicks).
      let current = '';
      segments.slice(0, -1).forEach((segment) => {
        current = current ? `${current}/${segment}` : segment;
        next.add(current);
      });
      return { expandedPaths: next };
    }),

  expandAll: () =>
    set((state) => {
      // Use pre-computed folder paths for O(1) expandAll
      return { expandedPaths: new Set(state.allFolderPaths) };
    }),

  collapseAll: () => set({ expandedPaths: new Set() }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  setCounts: (counts) => set({ counts }),

  updateFileInTree: (relativePath, update) =>
    set((state) => {
      const updateNode = (nodes: FileTreeNode[]): FileTreeNode[] => {
        return nodes.map((node) => {
          if (node.path === relativePath) {
            return { ...node, ...update };
          }
          if (node.type === 'folder' && node.children) {
            return { ...node, children: updateNode(node.children) };
          }
          return node;
        });
      };
      return { tree: updateNode(state.tree) };
    }),

  addFileToTree: (relativePath, newNode) =>
    set((state) => {
      const segments = relativePath.split('/');
      const parentPath = segments.slice(0, -1).join('/');

      const addNode = (nodes: FileTreeNode[]): FileTreeNode[] => {
        // Root level addition
        if (!parentPath) {
          const exists = nodes.some((n) => n.path === newNode.path);
          if (exists) return nodes;
          return [...nodes, newNode].sort((a, b) => {
            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
        }

        // Nested addition
        return nodes.map((node) => {
          if (node.path === parentPath && node.type === 'folder') {
            const children = node.children || [];
            const exists = children.some((n) => n.path === newNode.path);
            if (exists) return node;
            return {
              ...node,
              children: [...children, newNode].sort((a, b) => {
                if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                return a.name.localeCompare(b.name);
              }),
            };
          }
          if (node.type === 'folder' && node.children) {
            return { ...node, children: addNode(node.children) };
          }
          return node;
        });
      };

      const newTree = addNode(state.tree);

      // Update allFolderPaths cache if adding a folder
      if (newNode.type === 'folder') {
        const newFolderPaths = new Set(state.allFolderPaths);
        newFolderPaths.add(newNode.path);
        return { tree: newTree, allFolderPaths: newFolderPaths };
      }

      return { tree: newTree };
    }),

  removeFileFromTree: (relativePath) =>
    set((state) => {
      const removeNode = (nodes: FileTreeNode[]): FileTreeNode[] => {
        return nodes
          .filter((node) => node.path !== relativePath)
          .map((node) => {
            if (node.type === 'folder' && node.children) {
              return { ...node, children: removeNode(node.children) };
            }
            return node;
          });
      };

      const newTree = removeNode(state.tree);

      // Update allFolderPaths cache - remove the path if it was a folder
      if (state.allFolderPaths.has(relativePath)) {
        const newFolderPaths = new Set(state.allFolderPaths);
        newFolderPaths.delete(relativePath);
        return { tree: newTree, allFolderPaths: newFolderPaths };
      }

      return { tree: newTree };
    }),
}));
