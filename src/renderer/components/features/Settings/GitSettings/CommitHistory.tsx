import { Clock } from '@phosphor-icons/react';
import { ContainerStack } from '@renderer/components/base/ui';
import { Label } from '@renderer/components/base/ui/text';

interface Commit {
  hash: string;
  message: string;
  date: string;
}

export function CommitHistory({ commits }: { commits: Commit[] }) {
  if (commits.length === 0) return null;

  return (
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
  );
}
