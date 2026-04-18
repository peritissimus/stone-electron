import { SettingsSection } from '../SettingsSection';
import { StatusCard } from '../StatusCard';
import { Message } from '../Message';
import { ContainerStack, Separator } from '@renderer/components/base/ui';
import { Body } from '@renderer/components/base/ui/text';
import { useGitSettings } from './useGitSettings';
import { InitRepoSection } from './InitRepoSection';
import { RemoteConfigSection } from './RemoteConfigSection';
import { SyncActions } from './SyncActions';
import { CommitHistory } from './CommitHistory';

export function GitSettings() {
  const {
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
  } = useGitSettings();

  if (!activeWorkspace) {
    return (
      <SettingsSection title="Git Sync">
        <Body variant="muted">No workspace selected</Body>
      </SettingsSection>
    );
  }

  if (status && !status.isRepo) {
    return (
      <InitRepoSection
        workspaceName={activeWorkspace.name}
        workspacePath={activeWorkspace.folderPath}
        message={message}
        loading={loading}
        onInit={handleInit}
      />
    );
  }

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
        <ContainerStack gap="xs">
          <Body weight="medium">{activeWorkspace.name}</Body>
          <Body size="sm" variant="muted">
            {activeWorkspace.folderPath}
          </Body>
        </ContainerStack>

        {status && <StatusCard items={statusItems} />}

        {message && <Message type={message.type} text={message.text} />}

        {status && (
          <RemoteConfigSection
            hasRemote={status.hasRemote}
            remoteUrlFromStatus={status.remoteUrl}
            remoteUrl={remoteUrl}
            setRemoteUrl={setRemoteUrl}
            showRemoteInput={showRemoteInput}
            setShowRemoteInput={setShowRemoteInput}
            onSetRemote={handleSetRemote}
            loading={loading}
          />
        )}

        <Separator />

        {status && (
          <SyncActions
            status={status}
            syncing={syncing}
            loading={loading}
            onSync={handleSync}
            onCommit={handleCommit}
            onPull={handlePull}
            onPush={handlePush}
          />
        )}

        {commits.length > 0 && (
          <>
            <Separator />
            <CommitHistory commits={commits} />
          </>
        )}
      </ContainerStack>
    </SettingsSection>
  );
}
