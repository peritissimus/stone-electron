/**
 * Git API Hook - React hook for git operations
 */

import { useCallback, useState } from 'react';
import { gitAPI, type GitStatus, type GitCommit, type GitSyncResult, type GitCommitResult } from '@renderer/api';
import { logger } from '@renderer/utils/logger';

interface UseGitAPIState {
  status: GitStatus | null;
  commits: GitCommit[];
  loading: boolean;
  syncing: boolean;
  error: string | null;
}

export function useGitAPI() {
  const [state, setState] = useState<UseGitAPIState>({
    status: null,
    commits: [],
    loading: false,
    syncing: false,
    error: null,
  });

  const setError = useCallback((error: string | null) => {
    setState((s) => ({ ...s, error }));
  }, []);

  const getStatus = useCallback(async (workspaceId: string): Promise<GitStatus | null> => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await gitAPI.getStatus(workspaceId);
      if (response.success && response.data) {
        setState((s) => ({ ...s, status: response.data!, loading: false }));
        return response.data;
      } else {
        setError(response.error?.message || 'Failed to get git status');
        setState((s) => ({ ...s, loading: false }));
        return null;
      }
    } catch (err) {
      logger.error('[useGitAPI.getStatus] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get git status');
      setState((s) => ({ ...s, loading: false }));
      return null;
    }
  }, [setError]);

  const getCommits = useCallback(async (workspaceId: string, limit?: number): Promise<GitCommit[]> => {
    try {
      const response = await gitAPI.getCommits(workspaceId, limit);
      if (response.success && response.data) {
        setState((s) => ({ ...s, commits: response.data!.commits }));
        return response.data.commits;
      }
      return [];
    } catch (err) {
      logger.error('[useGitAPI.getCommits] Error:', err);
      return [];
    }
  }, []);

  const init = useCallback(async (workspaceId: string): Promise<boolean> => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await gitAPI.init(workspaceId);
      setState((s) => ({ ...s, loading: false }));
      if (response.success) {
        logger.info('[useGitAPI.init] Repository initialized');
        return true;
      } else {
        setError(response.error?.message || 'Failed to initialize repository');
        return false;
      }
    } catch (err) {
      logger.error('[useGitAPI.init] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize repository');
      setState((s) => ({ ...s, loading: false }));
      return false;
    }
  }, [setError]);

  const setRemote = useCallback(async (workspaceId: string, url: string): Promise<boolean> => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await gitAPI.setRemote(workspaceId, url);
      setState((s) => ({ ...s, loading: false }));
      if (response.success) {
        logger.info('[useGitAPI.setRemote] Remote URL set');
        return true;
      } else {
        setError(response.error?.message || 'Failed to set remote URL');
        return false;
      }
    } catch (err) {
      logger.error('[useGitAPI.setRemote] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to set remote URL');
      setState((s) => ({ ...s, loading: false }));
      return false;
    }
  }, [setError]);

  const commit = useCallback(async (workspaceId: string, message?: string): Promise<GitCommitResult | null> => {
    setState((s) => ({ ...s, syncing: true, error: null }));
    try {
      const response = await gitAPI.commit(workspaceId, message);
      setState((s) => ({ ...s, syncing: false }));
      if (response.success && response.data) {
        logger.info('[useGitAPI.commit] Changes committed', { hash: response.data.hash });
        return response.data;
      } else {
        setError(response.error?.message || 'Failed to commit changes');
        return null;
      }
    } catch (err) {
      logger.error('[useGitAPI.commit] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to commit changes');
      setState((s) => ({ ...s, syncing: false }));
      return null;
    }
  }, [setError]);

  const pull = useCallback(async (workspaceId: string): Promise<GitSyncResult | null> => {
    setState((s) => ({ ...s, syncing: true, error: null }));
    try {
      const response = await gitAPI.pull(workspaceId);
      setState((s) => ({ ...s, syncing: false }));
      if (response.success && response.data) {
        logger.info('[useGitAPI.pull] Changes pulled', { pulled: response.data.pulled });
        return response.data;
      } else {
        setError(response.error?.message || 'Failed to pull changes');
        return null;
      }
    } catch (err) {
      logger.error('[useGitAPI.pull] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to pull changes');
      setState((s) => ({ ...s, syncing: false }));
      return null;
    }
  }, [setError]);

  const push = useCallback(async (workspaceId: string): Promise<GitSyncResult | null> => {
    setState((s) => ({ ...s, syncing: true, error: null }));
    try {
      const response = await gitAPI.push(workspaceId);
      setState((s) => ({ ...s, syncing: false }));
      if (response.success && response.data) {
        logger.info('[useGitAPI.push] Changes pushed', { pushed: response.data.pushed });
        return response.data;
      } else {
        setError(response.error?.message || 'Failed to push changes');
        return null;
      }
    } catch (err) {
      logger.error('[useGitAPI.push] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to push changes');
      setState((s) => ({ ...s, syncing: false }));
      return null;
    }
  }, [setError]);

  const sync = useCallback(async (workspaceId: string, message?: string): Promise<GitSyncResult | null> => {
    setState((s) => ({ ...s, syncing: true, error: null }));
    try {
      const response = await gitAPI.sync(workspaceId, message);
      setState((s) => ({ ...s, syncing: false }));
      if (response.success && response.data) {
        logger.info('[useGitAPI.sync] Sync complete', response.data);
        return response.data;
      } else {
        setError(response.error?.message || 'Failed to sync');
        return null;
      }
    } catch (err) {
      logger.error('[useGitAPI.sync] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync');
      setState((s) => ({ ...s, syncing: false }));
      return null;
    }
  }, [setError]);

  return {
    // State
    status: state.status,
    commits: state.commits,
    loading: state.loading,
    syncing: state.syncing,
    error: state.error,
    // Actions
    getStatus,
    getCommits,
    init,
    setRemote,
    commit,
    pull,
    push,
    sync,
    clearError: () => setError(null),
  };
}
