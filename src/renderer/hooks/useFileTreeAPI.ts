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

function mapStructure(node: FolderStructure): FileTreeNode | null {
  const normalizedPath = normalizePath(node.relativePath || node.path || node.name);

  if (node.type === 'folder') {
    const children =
      node.children
        ?.map((child) => mapStructure(child))
        .filter((child): child is FileTreeNode => Boolean(child)) ?? [];

    return {
      name: node.name,
      path: normalizedPath,
      type: 'folder',
      children,
    };
  }

  if (node.type === 'file') {
    return {
      name: node.name,
      path: normalizedPath,
      type: 'file',
    };
  }

  return null;
}

function toFileTree(nodes: FolderStructure[]): FileTreeNode[] {
  return (
    nodes
      ?.map((node) => mapStructure(node))
      .filter((node): node is FileTreeNode => Boolean(node)) ?? []
  );
}

export function useFileTreeAPI() {
  const {
    setTree,
    setActiveFolder,
    setSelectedFile,
    setLoading,
    setError,
    setCounts,
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

      const { activeFolder: prevActive, selectedFile: prevSelected } = useFileTreeStore.getState();

      const response = await window.electron.invoke<{
        structure: FolderStructure[];
        counts?: Record<string, number>;
      }>(WORKSPACE_CHANNELS.SCAN, { workspaceId });

      if (response.success && response.data) {
        const tree = toFileTree(response.data.structure || []);
        setTree(tree);
        if (response.data.counts) {
          setCounts(response.data.counts);
        }
        if (prevActive) {
          setActiveFolder(prevActive);
          if (prevSelected) {
            setSelectedFile(prevSelected);
          }
        } else {
          setActiveFolder(null);
        }
      } else {
        setError(response.error?.message || 'Failed to load workspace structure');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load workspace structure');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setTree, setActiveFolder]);

  const createFolder = useCallback(
    async ({ parentPath, name }: { parentPath?: string | null; name?: string } = {}) => {
      try {
        const response = await window.electron.invoke<{ folderPath: string }>(
          WORKSPACE_CHANNELS.CREATE_FOLDER,
          {
            name: name ?? 'New Folder',
            parentPath: parentPath ?? undefined,
          },
        );

        if (response.success && response.data) {
          return response.data.folderPath;
        }

        setError(response.error?.message || 'Failed to create folder');
        return null;
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to create folder');
        return null;
      }
    },
    [setError],
  );

  const renameFolder = useCallback(
    async (path: string, name: string) => {
      try {
        const response = await window.electron.invoke<{ folderPath: string }>(
          WORKSPACE_CHANNELS.RENAME_FOLDER,
          {
            path,
            name,
          },
        );

        if (response.success && response.data) {
          return response.data.folderPath;
        }

        setError(response.error?.message || 'Failed to rename folder');
        return null;
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to rename folder');
        return null;
      }
    },
    [setError],
  );

  const deleteFolder = useCallback(
    async (path: string) => {
      try {
        const response = await window.electron.invoke<{ success: boolean }>(
          WORKSPACE_CHANNELS.DELETE_FOLDER,
          { path },
        );

        if (response.success && response.data) {
          return response.data.success;
        }

        setError(response.error?.message || 'Failed to delete folder');
        return false;
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to delete folder');
        return false;
      }
    },
    [setError],
  );

  return {
    loadFileTree,
    expandAll,
    collapseAll,
    createFolder,
    renameFolder,
    deleteFolder,
  };
}
