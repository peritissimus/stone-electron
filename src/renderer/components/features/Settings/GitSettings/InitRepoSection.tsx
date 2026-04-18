import { Plus } from 'phosphor-react';
import { SettingsSection } from '../SettingsSection';
import { ActionCard } from '../ActionCard';
import { Message } from '../Message';
import { ContainerStack } from '@renderer/components/base/ui';
import { Body } from '@renderer/components/base/ui/text';
import type { GitSettingsMessage } from './useGitSettings';

interface Props {
  workspaceName: string;
  workspacePath: string;
  message: GitSettingsMessage;
  loading: boolean;
  onInit: () => void;
}

export function InitRepoSection({ workspaceName, workspacePath, message, loading, onInit }: Props) {
  return (
    <SettingsSection title="Git Sync">
      <ContainerStack gap="lg">
        <ContainerStack gap="sm">
          <Body variant="muted">
            Enable Git sync for <strong>{workspaceName}</strong> to version control your notes and
            sync across devices.
          </Body>
        </ContainerStack>

        {message && <Message type={message.type} text={message.text} />}

        <ActionCard
          title="Initialize Git Repository"
          description={`Create a git repository in ${workspacePath}`}
          buttonText="Initialize"
          buttonIcon={<Plus size={16} />}
          onClick={onInit}
          loading={loading}
        />
      </ContainerStack>
    </SettingsSection>
  );
}
