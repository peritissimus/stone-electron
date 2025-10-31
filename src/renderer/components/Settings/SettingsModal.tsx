/**
 * Settings Modal Component
 */

import { useState, useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { Database, HardDrive, Download, CheckCircle } from 'phosphor-react';
import { DATABASE_CHANNELS } from '@shared/constants/ipcChannels';
import { DatabaseStatus, BackupResult, VacuumResult, IntegrityResult } from '@shared/types';
import { logger } from '../../utils/logger';
import { TabbedModal } from '../Layout/TabbedModal';
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
      if (response.success) {
        setStatus(response.data);
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
        { label: 'Database Size', value: formatBytes(status.database_size) },
        { label: 'Notes', value: status.note_count },
        { label: 'Notebooks', value: status.notebook_count },
        { label: 'Tags', value: status.tag_count },
      ]
    : [];

  return (
    <SettingsSection title="Database Management">
      {/* Status */}
      {status && <StatusCard items={statusItems} className="mb-6" />}

      {/* Message */}
      {message && <Message type={message.type} text={message.text} className="mb-6" />}

      {/* Actions */}
      <div className="space-y-4">
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
      </div>
    </SettingsSection>
  );
}

function AppearanceSettings() {
  const { theme, setTheme } = useUIStore();

  return (
    <SettingsSection title="Appearance">
      <div className="space-y-4">
        <div>
          <Label className="mb-2">Theme</Label>
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
        </div>
      </div>
    </SettingsSection>
  );
}

function AboutSettings() {
  return (
    <SettingsSection title="About Stone">
      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🪨</div>
          <Heading4 className="mb-2">Stone</Heading4>
          <Body variant="muted" className="mb-4">
            Version 0.1.0
          </Body>
          <Body variant="muted" size="sm" className="max-w-md mx-auto">
            A production-ready note-taking application built with Electron, React, and TypeScript.
            Features comprehensive database management, full-text search, and rich text editing.
          </Body>
        </div>

        <div className="border-t border-border pt-4">
          <Body weight="medium" className="mb-2">
            Technology Stack
          </Body>
          <ul className="space-y-1">
            <li>
              <Body size="sm" variant="muted">
                • Electron 27 - Desktop application framework
              </Body>
            </li>
            <li>
              <Body size="sm" variant="muted">
                • React 18 - UI library
              </Body>
            </li>
            <li>
              <Body size="sm" variant="muted">
                • TypeScript - Type-safe development
              </Body>
            </li>
            <li>
              <Body size="sm" variant="muted">
                • Better-SQLite3 - Database engine
              </Body>
            </li>
            <li>
              <Body size="sm" variant="muted">
                • TipTap - Rich text editor
              </Body>
            </li>
            <li>
              <Body size="sm" variant="muted">
                • Tailwind CSS - Styling framework
              </Body>
            </li>
            <li>
              <Body size="sm" variant="muted">
                • Zustand - State management
              </Body>
            </li>
          </ul>
        </div>
      </div>
    </SettingsSection>
  );
}
