/**
 * GitSyncButton - Quick sync status and action in sidebar
 */

import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useWorkspaces } from '@renderer/hooks/useWorkspaces';
import { useGitAPI } from '@renderer/hooks/useGitAPI';
import { useFileEvents } from '@renderer/hooks/useFileEvents';
import { logger } from '@renderer/lib/logger';
import { cn } from '@renderer/lib/utils';
import {
  GitBranch,
  ArrowsClockwise,
  Check,
  Warning,
} from '@phosphor-icons/react';

function formatLastSync(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const minutes = Math.floor(ms / 60_000);
  const label =
    minutes < 1
      ? 'just now'
      : minutes < 60
        ? `${minutes}m ago`
        : minutes < 60 * 24
          ? `${Math.floor(minutes / 60)}h ago`
          : `${Math.floor(minutes / (60 * 24))}d ago`;
  return ` · last synced ${label}`;
}

export function GitSyncButton() {
  const { activeWorkspaceId } = useWorkspaces();
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
    if (!result) {
      toast.error('Sync failed — check Settings → Git Sync.');
      return;
    }
    logger.info('[GitSyncButton] Sync completed', result);

    if (result.success) {
      const moved =
        [
          result.pushed ? `↑${result.pushed}` : null,
          result.pulled ? `↓${result.pulled}` : null,
        ]
          .filter(Boolean)
          .join(' ') || null;
      toast.success(
        moved
          ? `Synced ${moved}`
          : result.committed
            ? 'Committed locally — no remote changes to exchange'
            : 'Already up to date',
      );
    } else {
      switch (result.errorKind) {
        case 'conflict': {
          const files = result.conflicts ?? [];
          toast.error(
            files.length > 0
              ? `Sync stopped: ${files.length} conflicting file${files.length === 1 ? '' : 's'} (${files
                  .slice(0, 2)
                  .join(', ')}${files.length > 2 ? '…' : ''})`
              : 'Sync stopped on a conflict',
            {
              description:
                'Your changes are committed locally and nothing was half-merged. Resolve the conflict in a git tool, then sync again.',
              duration: 10000,
            },
          );
          break;
        }
        case 'auth':
          toast.error('Git authentication failed', {
            description:
              'Check your SSH key or stored credentials for the remote, then sync again.',
          });
          break;
        case 'network':
          toast.error("Can't reach the remote", {
            description: 'You appear to be offline. Your changes are committed locally.',
          });
          break;
        default:
          toast.error('Sync failed', { description: result.error });
      }
    }
    await loadStatus();
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
        type="button"
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
              : `Sync workspace (commit, pull --rebase, push)${formatLastSync(status.lastSyncAt)}`
        }
      >
        <div className="flex items-center gap-2">
          <GitBranch size={14} className="text-muted-foreground" />
          <span className="text-muted-foreground truncate max-w-[80px]">
            {status.branch || 'main'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 tabular-nums">
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
