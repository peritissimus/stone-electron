/**
 * GitSyncButton - Quick sync status and action in sidebar
 */

import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useWorkspaces } from '@renderer/services/workspace/hooks/useWorkspaces';
import { useGitAPI } from '@renderer/services/system/commands/useGitAPI';
import { useFileEvents } from '@renderer/services/workspace/hooks/useFileEvents';
import { logger } from '@renderer/services/telemetry/logger';
import { cn } from '@renderer/lib/utils';
import { GitBranch, ArrowsClockwise, Check, Warning } from '@phosphor-icons/react';

const countFormat = new Intl.NumberFormat();

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
      toast.error('Sync failed', { description: 'Check Settings → Git Sync.' });
      return;
    }
    logger.info('[GitSyncButton] Sync completed', result);

    if (result.success) {
      const moved =
        [
          result.pushed ? `↑${countFormat.format(result.pushed)}` : null,
          result.pulled ? `↓${countFormat.format(result.pulled)}` : null,
        ]
          .filter(Boolean)
          .join(' ') || null;
      toast.success(moved ? `Synced ${moved}` : 'Up to date');
    } else {
      switch (result.errorKind) {
        case 'conflict': {
          const files = result.conflicts ?? [];
          toast.error(
            files.length > 0
              ? `Conflict in ${countFormat.format(files.length)} file${files.length === 1 ? '' : 's'}`
              : 'Sync conflict',
            {
              description: `Your notes are safe, committed locally. Resolve in a git tool.${
                files.length > 0
                  ? ` (${files.slice(0, 2).join(', ')}${files.length > 2 ? '…' : ''})`
                  : ''
              }`,
              duration: 10000,
            },
          );
          break;
        }
        case 'auth':
          toast.error('Authentication failed', {
            description: 'Check your SSH key or credentials.',
          });
          break;
        case 'network':
          toast.error('Offline', { description: 'Changes saved locally. Will sync later.' });
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
  const branch = status.branch || 'main';
  const localChangesLabel = `${countFormat.format(totalChanges)} local ${totalChanges === 1 ? 'change' : 'changes'}`;
  const aheadLabel = `${countFormat.format(status.ahead)} ${status.ahead === 1 ? 'commit' : 'commits'} to push`;
  const behindLabel = `${countFormat.format(status.behind)} ${status.behind === 1 ? 'commit' : 'commits'} to pull`;
  const syncLabel = !status.hasRemote
    ? 'No remote configured - configure in Settings > Git Sync'
    : syncing
      ? 'Syncing...'
      : `Sync workspace (commit, pull --rebase, push)${formatLastSync(status.lastSyncAt)}`;
  const statusLabel = [
    hasLocalChanges && localChangesLabel,
    status.hasRemote && status.ahead > 0 && aheadLabel,
    status.hasRemote && status.behind > 0 && behindLabel,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div>
      <button
        type="button"
        onClick={handleSync}
        disabled={syncing || !status.hasRemote}
        className={cn(
          'flex min-h-10 min-w-0 w-full flex-col items-stretch justify-center gap-1 px-2 py-1.5 rounded-lg text-xs text-start',
          'text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.96]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          needsSync && status.hasRemote && 'bg-accent/30',
        )}
        title={`Branch: ${branch}\n${syncLabel}${statusLabel ? `\n${statusLabel}` : ''}`}
        aria-label={`${syncLabel}. Branch: ${branch}${statusLabel ? `. ${statusLabel}` : ''}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex size-4 shrink-0 items-center justify-center">
            <GitBranch size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 truncate text-muted-foreground" title={branch}>
            {branch}
          </span>

          {syncing ? (
            <ArrowsClockwise
              size={14}
              className="shrink-0 animate-spin text-primary"
              aria-hidden="true"
            />
          ) : needsSync && status.hasRemote ? (
            <ArrowsClockwise size={14} className="shrink-0 text-primary" aria-hidden="true" />
          ) : status.hasRemote ? (
            <Check size={14} className="shrink-0 text-green-500" aria-hidden="true" />
          ) : null}
        </span>

        {(hasLocalChanges || (status.hasRemote && hasRemoteChanges)) && (
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
            {hasLocalChanges && (
              <span
                className="flex shrink-0 items-center gap-0.5 whitespace-nowrap text-amber-500"
                title={localChangesLabel}
              >
                <Warning size={12} weight="fill" className="shrink-0" aria-hidden="true" />
                <span>{countFormat.format(totalChanges)}</span>
              </span>
            )}

            {status.hasRemote && status.ahead > 0 && (
              <span className="shrink-0 whitespace-nowrap text-blue-500" title={aheadLabel}>
                ↑{countFormat.format(status.ahead)}
              </span>
            )}
            {status.hasRemote && status.behind > 0 && (
              <span className="shrink-0 whitespace-nowrap text-orange-500" title={behindLabel}>
                ↓{countFormat.format(status.behind)}
              </span>
            )}
          </span>
        )}
      </button>
    </div>
  );
}
