import { useCallback } from 'react';
import { WORKSPACE_CHANNELS } from '@shared/constants/ipcChannels';
import { useFileTreeStore, FileTreeNode } from '@renderer/stores/fileTreeStore';

interface FolderStructure {
  name: string;
  path: string;
  relativePath: string;
  type: 'file' | 'folder';
  children?: FolderStructure[];
}

const normalizePath = (path: string) =>
  path
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

function toFileTree(nodes: FolderStructure[]): FileTreeNode[] {
  return nodes
    .filter((node) => node.type === 'folder')
    .map((node) => ({
      name: node.name,
      path: normalizePath(node.relativePath),
      type: 'folder' as const,
      children: node.children ? toFileTree(node.children) : [],
    }));
}

export function useFileTreeAPI() {
  const {
    setTree,
    setActiveFolder,
    setLoading,
    setError,
    expandAll,
    collapseAll,
  } = useFileTreeStore();

  const loadFileTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activeWorkspace = await window.electron.invoke<{
        workspace?: { id: string };
      }>(WORKSPACE_CHANNELS.GET_ACTIVE, undefined);

      const workspaceId = activeWorkspace.success ? activeWorkspace.data?.workspace?.id : undefined;

      if (!workspaceId) {
        setError('No active workspace selected');
        setTree([]);
        return;
      }

      const response = await window.electron.invoke<{
        structure: FolderStructure[];
      }>(WORKSPACE_CHANNELS.SCAN, { workspaceId });

      if (response.success && response.data) {
        const tree = toFileTree(response.data.structure || []);
        setTree(tree);
        setActiveFolder(null);
        collapseAll();
      } else {
        setError(response.error?.message || 'Failed to load workspace structure');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load workspace structure');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setTree, setActiveFolder, collapseAll]);

  return {
    loadFileTree,
    expandAll,
    collapseAll,
  };
}
