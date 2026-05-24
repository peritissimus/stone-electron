import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, HardDrive } from 'phosphor-react';
import { useDatabaseAPI } from '@renderer/hooks/useDatabaseAPI';
import { ContainerStack } from '@renderer/components/base/ui';
import type { DatabaseStatus } from '@shared/types';
import { SettingsSection } from './SettingsSection';
import { StatusCard } from './StatusCard';
import { Message } from './Message';
import { ActionCard } from './ActionCard';

export function DatabaseSettings() {
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { getStatus, vacuum, checkIntegrity, loading } = useDatabaseAPI();

  const loadStatus = useCallback(async () => {
    const status = await getStatus();
    setDbStatus(status);
  }, [getStatus]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleVacuum = async () => {
    if (!confirm('This will optimize the database and may take a few moments. Continue?')) return;

    setMessage(null);
    const result = await vacuum();
    if (result) {
      const freedMB = (result.freed_bytes / 1024 / 1024).toFixed(2);
      setMessage({ type: 'success', text: `Database optimized. Freed ${freedMB} MB` });
      await loadStatus();
    } else {
      setMessage({ type: 'error', text: 'Optimization failed' });
    }
  };

  const handleCheckIntegrity = async () => {
    setMessage(null);
    const result = await checkIntegrity();
    if (result) {
      if (result.ok) {
        setMessage({ type: 'success', text: 'Database integrity check passed' });
      } else {
        setMessage({
          type: 'error',
          text: `Integrity check failed: ${result.errors.join(', ')}`,
        });
      }
    } else {
      setMessage({ type: 'error', text: 'Integrity check failed' });
    }
  };

  const formatBytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

  const statusItems = dbStatus
    ? [
        { label: 'Database Size', value: formatBytes(dbStatus.databaseSize) },
        { label: 'Notes', value: dbStatus.noteCount },
        { label: 'Notebooks', value: dbStatus.notebookCount },
        { label: 'Tags', value: dbStatus.tagCount },
      ]
    : [];

  return (
    <SettingsSection
      title="Database"
      description="Local SQLite store for your workspace. Optimize reclaims space; integrity check verifies the file is healthy."
    >
      <ContainerStack gap="lg">
        {dbStatus && <StatusCard items={statusItems} />}

        {message && <Message type={message.type} text={message.text} />}

        <ContainerStack gap="md">
          <ActionCard
            title="Optimize Database"
            description="Reclaim space and improve performance"
            buttonText="Optimize"
            buttonIcon={<HardDrive size={16} />}
            onClick={handleVacuum}
            loading={loading}
            variant="secondary"
          />

          <ActionCard
            title="Check Integrity"
            description="Verify database integrity"
            buttonText="Check"
            buttonIcon={<CheckCircle size={16} />}
            onClick={handleCheckIntegrity}
            loading={loading}
            variant="secondary"
          />
        </ContainerStack>
      </ContainerStack>
    </SettingsSection>
  );
}
