import { Check, X, Plus } from '@phosphor-icons/react';
import { ContainerStack } from '@renderer/components/base/ui';
import { Button } from '@renderer/components/base/ui/button';
import { Input } from '@renderer/components/base/ui/input';
import { Label, Body } from '@renderer/components/base/ui/text';

interface Props {
  hasRemote: boolean;
  remoteUrlFromStatus: string | null | undefined;
  remoteUrl: string;
  setRemoteUrl: (value: string) => void;
  showRemoteInput: boolean;
  setShowRemoteInput: (value: boolean) => void;
  onSetRemote: () => void;
  loading: boolean;
}

export function RemoteConfigSection({
  hasRemote,
  remoteUrlFromStatus,
  remoteUrl,
  setRemoteUrl,
  showRemoteInput,
  setShowRemoteInput,
  onSetRemote,
  loading,
}: Props) {
  if (!hasRemote) {
    return (
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
              <Button onClick={onSetRemote} disabled={!remoteUrl.trim() || loading}>
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
    );
  }

  if (remoteUrlFromStatus) {
    return (
      <ContainerStack gap="xs">
        <Label>Remote URL</Label>
        <Body size="sm" variant="muted" className="font-mono break-all">
          {remoteUrlFromStatus}
        </Body>
      </ContainerStack>
    );
  }

  return null;
}
