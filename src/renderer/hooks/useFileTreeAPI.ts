import { useCallback } from 'react';
import { useFileTreeStore, FileTreeNode } from '@renderer/stores/fileTreeStore';
import { logger } from '@renderer/utils/logger';
import { workspaceAPI } from '@renderer/api';

// Module-level deduplication for loadFileTree calls
let pendingLoadFileTree: Promise<void> | null = null;

interface FolderStructure {
  name: string;
  path: string;
  relativePath: string;
  type: 'file' | 'folder';
  children?: FolderStructure[];
}

const normalizePath = (path: string) =>
  path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '').replace(/\/+$/, '');

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
    // Deduplicate: if same request is already pending, reuse it
    if (pendingLoadFileTree) {
      logger.info('[useFileTreeAPI.loadFileTree] Deduplicating request, reusing pending call');
      return pendingLoadFileTree;
    }

    setLoading(true);
    setError(null);

    const doLoad = async () => {
      try {
        const activeWorkspace = await workspaceAPI.getActive();

        const workspaceId = activeWorkspace.success
          ? activeWorkspace.data?.workspace?.id
          : undefined;

        if (!workspaceId) {
          setError('No active workspace selected');
          setTree([]);
          return;
        }

        const { activeFolder: prevActive, selectedFile: prevSelected } =
          useFileTreeStore.getState();

        const response = await workspaceAPI.scan(workspaceId);

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
          logger.info('[useFileTreeAPI.loadFileTree] Tree loaded');
        } else {
          setError(response.error?.message || 'Failed to load workspace structure');
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load workspace structure');
      } finally {
        setLoading(false);
        pendingLoadFileTree = null;
      }
    };

    pendingLoadFileTree = doLoad();
    return pendingLoadFileTree;
  }, [setLoading, setError, setTree, setActiveFolder]);

  const createFolder = useCallback(
    async ({ parentPath, name }: { parentPath?: string | null; name?: string } = {}) => {
      try {
        const response = await workspaceAPI.createFolder(
          name ?? 'New Folder',
          parentPath ?? undefined,
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
        const response = await workspaceAPI.renameFolder(path, name);

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
        const response = await workspaceAPI.deleteFolder(path);

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

  const moveFolder = useCallback(
    async (sourcePath: string, destinationPath: string | null) => {
      try {
        const response = await workspaceAPI.moveFolder(sourcePath, destinationPath);

        if (response.success && response.data) {
          return response.data.folderPath;
        }

        setError(response.error?.message || 'Failed to move folder');
        return null;
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to move folder');
        return null;
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
    moveFolder,
  };
}
