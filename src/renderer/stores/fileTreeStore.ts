import { create } from 'zustand';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  children?: FileTreeNode[];
}

interface FileTreeState {
  tree: FileTreeNode[];
  activeFolder: string | null;
  selectedFile: string | null;
  expandedPaths: Set<string>;
  loading: boolean;
  error: string | null;
  counts: Record<string, number>;
  setTree: (tree: FileTreeNode[]) => void;
  setActiveFolder: (path: string | null) => void;
  setSelectedFile: (path: string | null) => void;
  toggleExpanded: (path: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCounts: (counts: Record<string, number>) => void;
}

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  tree: [],
  activeFolder: null,
  selectedFile: null,
  expandedPaths: new Set(),
  loading: false,
  error: null,
  counts: {},
  counts: {},

  setTree: (tree) => set({ tree }),
  setActiveFolder: (path) =>
    set((state) => {
      if (!path) {
        return { activeFolder: null, selectedFile: null };
      }

      const normalized = path
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');

      const nextExpanded = new Set(state.expandedPaths);
      const segments = normalized.split('/');
      let current = '';
      segments.forEach((segment) => {
        current = current ? `${current}/${segment}` : segment;
        nextExpanded.add(current);
      });

      return {
        activeFolder: normalized,
        selectedFile: null,
        expandedPaths: nextExpanded,
      };
    }),

  setSelectedFile: (path) => set({ selectedFile: path }),

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

  expandAll: () =>
    set((state) => {
      const collect = (nodes: FileTreeNode[], acc: Set<string>) => {
        nodes.forEach((node) => {
          if (node.type !== 'folder') return;
          acc.add(node.path);
          if (node.children && node.children.length > 0) {
            collect(node.children, acc);
          }
        });
      };
      const paths = new Set<string>();
      collect(state.tree, paths);
      return { expandedPaths: paths };
    }),

  collapseAll: () => set({ expandedPaths: new Set() }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  setCounts: (counts) => set({ counts }),
}));
