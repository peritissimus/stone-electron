/**
 * GitSyncButton - Quick sync status and action in sidebar
 */

import { useEffect, useCallback } from 'react';
import { useWorkspaceStore } from '@renderer/stores/workspaceStore';
import { useGitAPI } from '@renderer/hooks/useGitAPI';
import { useFileEvents } from '@renderer/hooks/useFileEvents';
import { logger } from '@renderer/utils/logger';
import { cn } from '@renderer/lib/utils';
import {
  GitBranch,
  ArrowsClockwise,
  Check,
  Warning,
} from 'phosphor-react';

export function GitSyncButton() {
  const { activeWorkspaceId } = useWorkspaceStore();
  const { status, syncing, getStatus, sync } = useGitAPI();

  const loadStatus = useCallback(async () => {
    if (!activeWorkspaceId) return;
    await getStatus(activeWorkspaceId);
  }, [activeWorkspaceId, getStatus]);

  // Load status on mount and when workspace changes
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Refresh status on file changes
  useFileEvents({
    onCreated: activeWorkspaceId ? loadStatus : undefined,
    onChanged: activeWorkspaceId ? loadStatus : undefined,
    onDeleted: activeWorkspaceId ? loadStatus : undefined,
  });

  const handleSync = async () => {
    if (!activeWorkspaceId || syncing) return;

    const result = await sync(activeWorkspaceId);
    if (result) {
      logger.info('[GitSyncButton] Sync completed');
      await loadStatus();
    }
  };

  // Don't show if no workspace or not a git repo
  if (!status || !status.isRepo) {
    return null;
  }

  const totalChanges = status.staged + status.unstaged + status.untracked;
  const hasRemoteChanges = status.ahead > 0 || status.behind > 0;
  const hasLocalChanges = totalChanges > 0;
  const needsSync = hasLocalChanges || hasRemoteChanges;

  return (
    <div className="px-2 py-1.5 border-t border-border">
      <button
        onClick={handleSync}
        disabled={syncing || !status.hasRemote}
        className={cn(
          'flex items-center justify-between w-full px-2 py-1.5 rounded text-xs',
          'hover:bg-accent/50 transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          needsSync && status.hasRemote && 'bg-accent/30',
        )}
        title={
          !status.hasRemote
            ? 'No remote configured - configure in Settings > Git Sync'
            : syncing
              ? 'Syncing...'
              : 'Sync workspace (commit, pull, push)'
        }
      >
        <div className="flex items-center gap-2">
          <GitBranch size={14} className="text-muted-foreground" />
          <span className="text-muted-foreground truncate max-w-[80px]">
            {status.branch || 'main'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {hasLocalChanges && (
            <span
              className="flex items-center gap-0.5 text-amber-500"
              title={`${totalChanges} local changes`}
            >
              <Warning size={12} weight="fill" />
              <span>{totalChanges}</span>
            </span>
          )}

          {status.hasRemote && status.ahead > 0 && (
            <span className="text-blue-500" title={`${status.ahead} commits to push`}>
              ↑{status.ahead}
            </span>
          )}
          {status.hasRemote && status.behind > 0 && (
            <span className="text-orange-500" title={`${status.behind} commits to pull`}>
              ↓{status.behind}
            </span>
          )}

          {syncing ? (
            <ArrowsClockwise size={14} className="animate-spin text-primary" />
          ) : needsSync && status.hasRemote ? (
            <ArrowsClockwise size={14} className="text-primary" />
          ) : status.hasRemote ? (
            <Check size={14} className="text-green-500" />
          ) : null}
        </div>
      </button>
    </div>
  );
}
