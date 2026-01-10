/**
 * Git Settings Component
 * Configure and sync workspace with git
 */

import { useState, useEffect, useCallback } from 'react';
import {
  GitBranch,
  CloudArrowUp,
  CloudArrowDown,
  ArrowsClockwise,
  Check,
  X,
  Plus,
  Clock,
} from 'phosphor-react';
import { useWorkspaceStore } from '@renderer/stores/workspaceStore';
import { useGitAPI } from '@renderer/hooks/useGitAPI';
import { logger } from '@renderer/utils/logger';
import type { GitStatus, GitCommit } from '@renderer/api';
import { SettingsSection } from './SettingsSection';
import { ActionCard } from './ActionCard';
import { StatusCard } from './StatusCard';
import { Message } from './Message';
import { ContainerStack, Separator } from '@renderer/components/base/ui';
import { Button } from '@renderer/components/base/ui/button';
import { Input } from '@renderer/components/base/ui/input';
import { Label, Body, Heading4 } from '@renderer/components/base/ui/text';

export function GitSettings() {
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
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

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [showRemoteInput, setShowRemoteInput] = useState(false);

  // Load git status
  const loadStatus = useCallback(async () => {
    if (!activeWorkspaceId) return;

    const gitStatus = await getStatus(activeWorkspaceId);
    if (gitStatus) {
      setRemoteUrl(gitStatus.remoteUrl || '');
      // Load commits if repo exists
      if (gitStatus.isRepo) {
        await getCommits(activeWorkspaceId, 5);
      }
    }
  }, [activeWorkspaceId, getStatus, getCommits]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Initialize git repo
  const handleInit = async () => {
    if (!activeWorkspaceId) return;

    setMessage(null);
    const success = await init(activeWorkspaceId);
    if (success) {
      setMessage({ type: 'success', text: 'Git repository initialized' });
      await loadStatus();
    } else {
      setMessage({ type: 'error', text: 'Failed to initialize repository' });
    }
  };

  // Set remote URL
  const handleSetRemote = async () => {
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
  };

  // Sync (commit + pull + push)
  const handleSync = async () => {
    if (!activeWorkspaceId) return;

    setMessage(null);
    const result = await sync(activeWorkspaceId);
    if (result) {
      setMessage({ type: 'success', text: 'Workspace synced successfully' });
      await loadStatus();
    } else {
      setMessage({ type: 'error', text: 'Sync failed' });
    }
  };

  // Commit only
  const handleCommit = async () => {
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
  };

  // Pull only
  const handlePull = async () => {
    if (!activeWorkspaceId) return;

    setMessage(null);
    const result = await pull(activeWorkspaceId);
    if (result) {
      setMessage({ type: 'success', text: 'Pulled latest changes' });
      await loadStatus();
    } else {
      setMessage({ type: 'error', text: 'Pull failed' });
    }
  };

  // Push only
  const handlePush = async () => {
    if (!activeWorkspaceId) return;

    setMessage(null);
    const result = await push(activeWorkspaceId);
    if (result) {
      setMessage({ type: 'success', text: 'Pushed changes to remote' });
      await loadStatus();
    } else {
      setMessage({ type: 'error', text: 'Push failed' });
    }
  };

  if (!activeWorkspace) {
    return (
      <SettingsSection title="Git Sync">
        <Body variant="muted">No workspace selected</Body>
      </SettingsSection>
    );
  }

  // Not a git repo - show init option
  if (status && !status.isRepo) {
    return (
      <SettingsSection title="Git Sync">
        <ContainerStack gap="lg">
          <ContainerStack gap="sm">
            <Body variant="muted">
              Enable Git sync for <strong>{activeWorkspace.name}</strong> to version control your
              notes and sync across devices.
            </Body>
          </ContainerStack>

          {message && <Message type={message.type} text={message.text} />}

          <ActionCard
            title="Initialize Git Repository"
            description={`Create a git repository in ${activeWorkspace.folderPath}`}
            buttonText="Initialize"
            buttonIcon={<Plus size={16} />}
            onClick={handleInit}
            loading={loading}
          />
        </ContainerStack>
      </SettingsSection>
    );
  }

  // Git repo exists - show status and sync options
  const statusItems = status
    ? [
        { label: 'Branch', value: status.branch || 'unknown' },
        { label: 'Remote', value: status.hasRemote ? 'Connected' : 'Not configured' },
        ...(status.hasRemote
          ? [
              { label: 'Ahead', value: status.ahead },
              { label: 'Behind', value: status.behind },
            ]
          : []),
        { label: 'Staged', value: status.staged },
        { label: 'Modified', value: status.unstaged },
        { label: 'Untracked', value: status.untracked },
      ]
    : [];

  return (
    <SettingsSection title="Git Sync">
      <ContainerStack gap="lg">
        {/* Workspace info */}
        <ContainerStack gap="xs">
          <Body weight="medium">{activeWorkspace.name}</Body>
          <Body size="sm" variant="muted">
            {activeWorkspace.folderPath}
          </Body>
        </ContainerStack>

        {/* Status */}
        {status && <StatusCard items={statusItems} />}

        {/* Message */}
        {message && <Message type={message.type} text={message.text} />}

        {/* Remote URL configuration */}
        {status && !status.hasRemote && (
          <ContainerStack gap="sm">
            <Label>Remote Repository</Label>
            {showRemoteInput ? (
              <ContainerStack gap="sm">
                <Input
                  placeholder="https://github.com/user/repo.git"
                  value={remoteUrl}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button onClick={handleSetRemote} disabled={!remoteUrl.trim() || loading}>
                    <Check size={16} className="mr-1" />
                    Save
                  </Button>
                  <Button variant="outline" onClick={() => setShowRemoteInput(false)}>
                    <X size={16} className="mr-1" />
                    Cancel
                  </Button>
                </div>
              </ContainerStack>
            ) : (
              <Button variant="outline" onClick={() => setShowRemoteInput(true)}>
                <Plus size={16} className="mr-1" />
                Add Remote URL
              </Button>
            )}
          </ContainerStack>
        )}

        {/* Show remote URL if configured */}
        {status?.hasRemote && status.remoteUrl && (
          <ContainerStack gap="xs">
            <Label>Remote URL</Label>
            <Body size="sm" variant="muted" className="font-mono break-all">
              {status.remoteUrl}
            </Body>
          </ContainerStack>
        )}

        <Separator />

        {/* Sync Actions */}
        <ContainerStack gap="md">
          {/* Main sync button */}
          {status?.hasRemote && (
            <ActionCard
              title="Sync Workspace"
              description="Commit changes, pull updates, and push to remote"
              buttonText={syncing ? 'Syncing...' : 'Sync Now'}
              buttonIcon={<ArrowsClockwise size={16} className={syncing ? 'animate-spin' : ''} />}
              onClick={handleSync}
              loading={syncing}
            />
          )}

          {/* Individual actions */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              onClick={handleCommit}
              disabled={loading || !status?.hasChanges}
              className="flex-col h-auto py-3"
            >
              <GitBranch size={20} className="mb-1" />
              <span className="text-xs">Commit</span>
              {status?.hasChanges && (
                <span className="text-xs text-muted-foreground">
                  ({status.staged + status.unstaged + status.untracked})
                </span>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handlePull}
              disabled={loading || !status?.hasRemote}
              className="flex-col h-auto py-3"
            >
              <CloudArrowDown size={20} className="mb-1" />
              <span className="text-xs">Pull</span>
              {status?.behind ? (
                <span className="text-xs text-muted-foreground">({status.behind})</span>
              ) : null}
            </Button>

            <Button
              variant="outline"
              onClick={handlePush}
              disabled={loading || !status?.hasRemote}
              className="flex-col h-auto py-3"
            >
              <CloudArrowUp size={20} className="mb-1" />
              <span className="text-xs">Push</span>
              {status?.ahead ? (
                <span className="text-xs text-muted-foreground">({status.ahead})</span>
              ) : null}
            </Button>
          </div>
        </ContainerStack>

        {/* Recent commits */}
        {commits.length > 0 && (
          <>
            <Separator />
            <ContainerStack gap="sm">
              <Label>Recent Commits</Label>
              <div className="space-y-2">
                {commits.map((commit) => (
                  <div
                    key={commit.hash}
                    className="flex items-start gap-2 text-sm p-2 rounded bg-muted/30"
                  >
                    <Clock size={14} className="mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs text-muted-foreground">{commit.hash}</div>
                      <div className="truncate">{commit.message}</div>
                      <div className="text-xs text-muted-foreground">{commit.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </ContainerStack>
          </>
        )}
      </ContainerStack>
    </SettingsSection>
  );
}
