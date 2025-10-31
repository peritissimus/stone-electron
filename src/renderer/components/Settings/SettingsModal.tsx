/**
 * Settings Modal Component
 */

import { useState, useEffect } from 'react';
import { useUIStore } from '@renderer/stores/uiStore';
import { Database, HardDrive, Download, CheckCircle } from 'phosphor-react';
import { DATABASE_CHANNELS } from '@shared/constants/ipcChannels';
import { DatabaseStatus, BackupResult, VacuumResult, IntegrityResult } from '@shared/types';
import { logger } from '@renderer/utils/logger';
import { TabbedModal } from '@renderer/components/Layout/TabbedModal';
import { SettingsSection } from './SettingsSection';
import { ActionCard } from './ActionCard';
import { StatusCard } from './StatusCard';
import { Message } from './Message';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';
import { Label, Body, Heading4 } from '@renderer/components/ui/text';
import { ContainerStack, ContainerCenter, Separator } from '@renderer/components/ui';

export function SettingsModal() {
  const { settingsOpen, closeSettings } = useUIStore();
  const [activeTab, setActiveTab] = useState<'database' | 'appearance' | 'about'>('database');

  if (!settingsOpen) return null;

  const tabs = [
    { id: 'database', label: 'Database', icon: <Database size={16} /> },
    { id: 'appearance', label: 'Appearance' },
    { id: 'about', label: 'About' },
  ];

  return (
    <TabbedModal
      title="Settings"
      onClose={closeSettings}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tabId) => setActiveTab(tabId as typeof activeTab)}
    >
      {activeTab === 'database' && <DatabaseSettings />}
      {activeTab === 'appearance' && <AppearanceSettings />}
      {activeTab === 'about' && <AboutSettings />}
    </TabbedModal>
  );
}

function DatabaseSettings() {
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const response = await window.electron.invoke<DatabaseStatus>(
        DATABASE_CHANNELS.GET_STATUS,
        {},
      );
      if (response.success && response.data) {
        setStatus(response.data);
      } else {
        setStatus(null);
      }
    } catch (error) {
      logger.error('Failed to load database status:', error);
    }
  };

  const handleBackup = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await window.electron.invoke<BackupResult>(DATABASE_CHANNELS.BACKUP, {
        label: 'manual',
      });
      if (response.success && response.data) {
        setMessage({
          type: 'success',
          text: `Backup created successfully (${(response.data.size / 1024 / 1024).toFixed(2)} MB)`,
        });
        await loadStatus();
      } else {
        setMessage({ type: 'error', text: response.error?.message || 'Backup failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Backup failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleVacuum = async () => {
    if (!confirm('This will optimize the database and may take a few moments. Continue?')) return;

    setLoading(true);
    setMessage(null);
    try {
      const response = await window.electron.invoke<VacuumResult>(DATABASE_CHANNELS.VACUUM, {});
      if (response.success && response.data) {
        const freedMB = (response.data.freed_bytes / 1024 / 1024).toFixed(2);
        setMessage({ type: 'success', text: `Database optimized. Freed ${freedMB} MB` });
        await loadStatus();
      } else {
        setMessage({ type: 'error', text: response.error?.message || 'Optimization failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Optimization failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIntegrity = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await window.electron.invoke<IntegrityResult>(
        DATABASE_CHANNELS.CHECK_INTEGRITY,
        {
          detailed: true,
        },
      );
      if (response.success && response.data) {
        if (response.data.ok) {
          setMessage({ type: 'success', text: 'Database integrity check passed' });
        } else {
          setMessage({
            type: 'error',
            text: `Integrity check failed: ${response.data.errors.join(', ')}`,
          });
        }
      } else {
        setMessage({ type: 'error', text: response.error?.message || 'Integrity check failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Integrity check failed' });
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const statusItems = status
    ? [
        { label: 'Database Size', value: formatBytes(status.databaseSize) },
        { label: 'Notes', value: status.noteCount },
        { label: 'Notebooks', value: status.notebookCount },
        { label: 'Tags', value: status.tagCount },
      ]
    : [];

  return (
    <SettingsSection title="Database Management">
      <ContainerStack gap="lg">
        {/* Status */}
        {status && <StatusCard items={statusItems} />}

        {/* Message */}
        {message && <Message type={message.type} text={message.text} />}

        {/* Actions */}
        <ContainerStack gap="md">
          <ActionCard
            title="Create Backup"
            description="Create a backup of your database"
            buttonText="Backup"
            buttonIcon={<Download size={16} />}
            onClick={handleBackup}
            loading={loading}
          />

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

function AppearanceSettings() {
  const { theme, setTheme } = useUIStore();

  return (
    <SettingsSection title="Appearance">
      <ContainerStack gap="sm">
        <Label>Theme</Label>
        <Select value={theme} onValueChange={setTheme}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </ContainerStack>
    </SettingsSection>
  );
}

function AboutSettings() {
  return (
    <SettingsSection title="About Stone">
      <ContainerStack gap="lg">
        <ContainerCenter maxWidth="md">
          <ContainerStack gap="md" align="center">
            <div className="text-6xl">🪨</div>
            <Heading4>Stone</Heading4>
            <Body variant="muted">Version 0.1.0</Body>
            <Body variant="muted" size="sm" className="text-center">
              A production-ready note-taking application built with Electron, React, and TypeScript.
              Features comprehensive database management, full-text search, and rich text editing.
            </Body>
          </ContainerStack>
        </ContainerCenter>

        <Separator />

        <ContainerStack gap="sm">
          <Body weight="medium">Technology Stack</Body>
          <ContainerStack gap="xs">
            <Body size="sm" variant="muted">
              • Electron 27 - Desktop application framework
            </Body>
            <Body size="sm" variant="muted">
              • React 18 - UI library
            </Body>
            <Body size="sm" variant="muted">
              • TypeScript - Type-safe development
            </Body>
            <Body size="sm" variant="muted">
              • Better-SQLite3 - Database engine
            </Body>
            <Body size="sm" variant="muted">
              • TipTap - Rich text editor
            </Body>
            <Body size="sm" variant="muted">
              • Tailwind CSS - Styling framework
            </Body>
            <Body size="sm" variant="muted">
              • Zustand - State management
            </Body>
          </ContainerStack>
        </ContainerStack>
      </ContainerStack>
    </SettingsSection>
  );
}
