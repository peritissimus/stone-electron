/**
 * Workspace API Hook - sync and workspace operations
 */

import { useCallback } from 'react';
import { useWorkspaceStore } from '@renderer/stores/workspaceStore';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useNoteStore } from '@renderer/stores/noteStore';
import { workspaceAPI } from '@renderer/api';

export function useWorkspaceAPI() {
  const { setWorkspaces, setActiveWorkspaceId, setLoading, setError } = useWorkspaceStore();
  const { setActiveFolder, setSelectedFile } = useFileTreeStore();
  const { setActiveNote } = useNoteStore();

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await workspaceAPI.getAll();

      if (response.success && response.data) {
        setWorkspaces(response.data.workspaces);
      } else {
        setError(response.error?.message || 'Failed to load workspaces');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setWorkspaces]);

  const setActiveWorkspace = useCallback(
    async (workspaceId: string) => {
      try {
        const response = await workspaceAPI.setActive(workspaceId);
        if (response.success) {
          setActiveWorkspaceId(workspaceId);
          setActiveFolder(null);
          setSelectedFile(null);
          setActiveNote(null);
          await loadWorkspaces();
        } else {
          setError(response.error?.message || 'Failed to switch workspace');
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to switch workspace');
      }
    },
    [
      loadWorkspaces,
      setActiveWorkspaceId,
      setActiveFolder,
      setSelectedFile,
      setActiveNote,
      setError,
    ],
  );

  const syncWorkspace = useCallback(
    async (workspaceId?: string) => {
      const response = await workspaceAPI.sync(workspaceId);

      if (response.success) {
        await loadWorkspaces();
      }

      return response;
    },
    [loadWorkspaces],
  );

  const selectFolder = useCallback(async () => {
    try {
      const response = await workspaceAPI.selectFolder();
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to select folder');
      return null;
    }
  }, [setError]);

  const createWorkspace = useCallback(
    async (data: { name: string; path: string }) => {
      setLoading(true);
      setError(null);
      try {
        const response = await workspaceAPI.create(data);
        if (response.success && response.data) {
          await loadWorkspaces();
          return response.data;
        } else {
          setError(response.error?.message || 'Failed to create workspace');
          return null;
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to create workspace');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [loadWorkspaces, setLoading, setError],
  );

  return { syncWorkspace, loadWorkspaces, setActiveWorkspace, selectFolder, createWorkspace };
}
