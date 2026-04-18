import { useState, useEffect, useCallback } from 'react';
import { useWorkspaces } from '@renderer/hooks/useWorkspaces';
import { useGitAPI } from '@renderer/hooks/useGitAPI';

export type GitSettingsMessage = { type: 'success' | 'error'; text: string } | null;

export function useGitSettings() {
  const { workspaces, activeWorkspaceId } = useWorkspaces();
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const {
    status,
    commits,
    loading,
    syncing,
    getStatus,
    getCommits,
    init,
    setRemote,
    commit,
    pull,
    push,
    sync,
  } = useGitAPI();

  const [message, setMessage] = useState<GitSettingsMessage>(null);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [showRemoteInput, setShowRemoteInput] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const gitStatus = await getStatus(activeWorkspaceId);
    if (gitStatus) {
      setRemoteUrl(gitStatus.remoteUrl || '');
      if (gitStatus.isRepo) {
        await getCommits(activeWorkspaceId, 5);
      }
    }
  }, [activeWorkspaceId, getStatus, getCommits]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleInit = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setMessage(null);
    const success = await init(activeWorkspaceId);
    if (success) {
      setMessage({ type: 'success', text: 'Git repository initialized' });
      await loadStatus();
    } else {
      setMessage({ type: 'error', text: 'Failed to initialize repository' });
    }
  }, [activeWorkspaceId, init, loadStatus]);

  const handleSetRemote = useCallback(async () => {
    if (!activeWorkspaceId || !remoteUrl.trim()) return;
    setMessage(null);
    const success = await setRemote(activeWorkspaceId, remoteUrl.trim());
    if (success) {
      setMessage({ type: 'success', text: 'Remote URL configured' });
      setShowRemoteInput(false);
      await loadStatus();
    } else {
      setMessage({ type: 'error', text: 'Failed to set remote URL' });
    }
  }, [activeWorkspaceId, remoteUrl, setRemote, loadStatus]);

  const handleSync = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setMessage(null);
    const result = await sync(activeWorkspaceId);
    if (result) {
      setMessage({ type: 'success', text: 'Workspace synced successfully' });
      await loadStatus();
    } else {
      setMessage({ type: 'error', text: 'Sync failed' });
    }
  }, [activeWorkspaceId, sync, loadStatus]);

  const handleCommit = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setMessage(null);
    const result = await commit(activeWorkspaceId);
    if (result) {
      if (result.hash) {
        setMessage({ type: 'success', text: `Committed: ${result.hash}` });
      } else {
        setMessage({ type: 'success', text: result.message || 'No changes to commit' });
      }
      await loadStatus();
    } else {
      setMessage({ type: 'error', text: 'Commit failed' });
    }
  }, [activeWorkspaceId, commit, loadStatus]);

  const handlePull = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setMessage(null);
    const result = await pull(activeWorkspaceId);
    if (result) {
      setMessage({ type: 'success', text: 'Pulled latest changes' });
      await loadStatus();
    } else {
      setMessage({ type: 'error', text: 'Pull failed' });
    }
  }, [activeWorkspaceId, pull, loadStatus]);

  const handlePush = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setMessage(null);
    const result = await push(activeWorkspaceId);
    if (result) {
      setMessage({ type: 'success', text: 'Pushed changes to remote' });
      await loadStatus();
    } else {
      setMessage({ type: 'error', text: 'Push failed' });
    }
  }, [activeWorkspaceId, push, loadStatus]);

  return {
    activeWorkspace,
    status,
    commits,
    loading,
    syncing,
    message,
    remoteUrl,
    setRemoteUrl,
    showRemoteInput,
    setShowRemoteInput,
    handleInit,
    handleSetRemote,
    handleSync,
    handleCommit,
    handlePull,
    handlePush,
  };
}
