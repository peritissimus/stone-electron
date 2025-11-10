import { create } from 'zustand';
import { logger } from '@renderer/utils/logger';

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
  updateFileInTree: (relativePath: string, update: Partial<FileTreeNode>) => void;
  addFileToTree: (relativePath: string, node: FileTreeNode) => void;
  removeFileFromTree: (relativePath: string) => void;
}

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  tree: [],
  activeFolder: null,
  selectedFile: null,
  expandedPaths: new Set(),
  loading: false,
  error: null,
  counts: {},

  setTree: (tree) => set({ tree }),
  setActiveFolder: (path) =>
    set((state) => {
      if (!path) {
        logger.info('[FileTreeStore] Clearing active folder');
        return { activeFolder: null, selectedFile: null };
      }

      const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
      logger.info('[FileTreeStore] Setting active folder', {
        originalPath: path,
        normalized,
        currentExpanded: Array.from(state.expandedPaths)
      });

      const nextExpanded = new Set(state.expandedPaths);
      const segments = normalized.split('/');
      let current = '';
      segments.forEach((segment) => {
        current = current ? `${current}/${segment}` : segment;
        nextExpanded.add(current);
      });

      logger.info('[FileTreeStore] Expanded paths after setting active folder', {
        added: segments,
        allExpanded: Array.from(nextExpanded)
      });

      return {
        activeFolder: normalized,
        selectedFile: null,
        expandedPaths: nextExpanded,
      };
    }),

  setSelectedFile: (path) =>
    set((state) => {
      if (!path) {
        logger.info('[FileTreeStore] Clearing selected file');
        return { selectedFile: null };
      }

      const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
      logger.info('[FileTreeStore] Setting selected file', {
        originalPath: path,
        normalized,
        currentExpanded: Array.from(state.expandedPaths)
      });

      // Extract parent folder path and expand all parent folders
      const segments = normalized.split('/');
      if (segments.length > 1) {
        const nextExpanded = new Set(state.expandedPaths);
        let current = '';
        const foldersToExpand: string[] = [];
        // Expand all parent folders (exclude the file name itself)
        segments.slice(0, -1).forEach((segment) => {
          current = current ? `${current}/${segment}` : segment;
          nextExpanded.add(current);
          foldersToExpand.push(current);
        });

        logger.info('[FileTreeStore] Expanding parent folders for selected file', {
          file: normalized,
          foldersExpanded: foldersToExpand,
          allExpanded: Array.from(nextExpanded)
        });

        return {
          selectedFile: normalized,
          expandedPaths: nextExpanded,
        };
      }

      logger.info('[FileTreeStore] File is at root level', { file: normalized });
      return { selectedFile: normalized };
    }),

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

      return { tree: addNode(state.tree) };
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
      return { tree: removeNode(state.tree) };
    }),
}));
