import { GitBranch, CloudArrowUp, CloudArrowDown, ArrowsClockwise } from '@phosphor-icons/react';
import { ActionCard } from '../ActionCard';
import { ContainerStack } from '@renderer/components/base/ui';
import { Button } from '@renderer/components/base/ui/button';

interface StatusLike {
  hasRemote?: boolean;
  hasChanges?: boolean;
  staged: number;
  unstaged: number;
  untracked: number;
  ahead?: number;
  behind?: number;
}

interface Props {
  status: StatusLike;
  syncing: boolean;
  loading: boolean;
  onSync: () => void;
  onCommit: () => void;
  onPull: () => void;
  onPush: () => void;
}

export function SyncActions({
  status,
  syncing,
  loading,
  onSync,
  onCommit,
  onPull,
  onPush,
}: Props) {
  return (
    <ContainerStack gap="md">
      {status.hasRemote && (
        <ActionCard
          title="Sync Workspace"
          description="Commit changes, pull updates, and push to remote"
          buttonText={syncing ? 'Syncing...' : 'Sync Now'}
          buttonIcon={<ArrowsClockwise size={16} className={syncing ? 'animate-spin' : ''} />}
          onClick={onSync}
          loading={syncing}
        />
      )}

      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          onClick={onCommit}
          disabled={loading || !status.hasChanges}
          className="flex-col h-auto py-3"
        >
          <GitBranch size={20} className="mb-1" />
          <span className="text-xs">Commit</span>
          {status.hasChanges && (
            <span className="text-xs text-muted-foreground">
              ({status.staged + status.unstaged + status.untracked})
            </span>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={onPull}
          disabled={loading || !status.hasRemote}
          className="flex-col h-auto py-3"
        >
          <CloudArrowDown size={20} className="mb-1" />
          <span className="text-xs">Pull</span>
          {status.behind ? (
            <span className="text-xs text-muted-foreground">({status.behind})</span>
          ) : null}
        </Button>

        <Button
          variant="outline"
          onClick={onPush}
          disabled={loading || !status.hasRemote}
          className="flex-col h-auto py-3"
        >
          <CloudArrowUp size={20} className="mb-1" />
          <span className="text-xs">Push</span>
          {status.ahead ? (
            <span className="text-xs text-muted-foreground">({status.ahead})</span>
          ) : null}
        </Button>
      </div>
    </ContainerStack>
  );
}
