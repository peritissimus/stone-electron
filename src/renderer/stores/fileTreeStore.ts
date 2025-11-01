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
  setTree: (tree: FileTreeNode[]) => void;
  setActiveFolder: (path: string | null) => void;
  setSelectedFile: (path: string | null) => void;
  toggleExpanded: (path: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  tree: [],
  activeFolder: null,
  selectedFile: null,
  expandedPaths: new Set(),
  loading: false,
  error: null,

  setTree: (tree) => set({ tree }),

  setActiveFolder: (path) => set({ activeFolder: path }),

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
          if (node.type === 'folder') {
            acc.add(node.path);
            if (node.children && node.children.length > 0) {
              collect(node.children, acc);
            }
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
}));
