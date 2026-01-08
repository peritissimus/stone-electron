/**
 * Settings Modal Component
 */

import { useState, useEffect } from 'react';
import { useUIStore, ACCENT_COLORS, type AccentColor } from '@renderer/stores/uiStore';
import { Database, HardDrive, Download, CheckCircle, Palette, Info, Keyboard, GitBranch } from 'phosphor-react';
import { useDatabaseAPI } from '@renderer/hooks/useDatabaseAPI';
import { DatabaseStatus } from '@shared/types';
import { TabbedModal } from '@renderer/components/composites';
import { SettingsSection } from './SettingsSection';
import { ActionCard } from './ActionCard';
import { StatusCard } from './StatusCard';
import { Message } from './Message';
import { FontSettings } from './FontSettings';
import { FontPreview } from './FontPreview';
import { KeyboardShortcutsSettings } from './KeyboardShortcutsSettings';
import { GitSettings } from './GitSettings';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/base/ui/select';
import { Switch } from '@renderer/components/base/ui/switch';
import { Label, Body, Heading4 } from '@renderer/components/base/ui/text';
import { ContainerStack, ContainerCenter, Separator } from '@renderer/components/base/ui';

export function SettingsModal() {
  const { settingsOpen, closeSettings } = useUIStore();
  const [activeTab, setActiveTab] = useState<'database' | 'appearance' | 'shortcuts' | 'git' | 'about'>('appearance');

  // Close on Escape key
  useEffect(() => {
    if (!settingsOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSettings();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsOpen, closeSettings]);

  if (!settingsOpen) return null;

  const tabs = [
    { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
    { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={16} /> },
    { id: 'git', label: 'Git Sync', icon: <GitBranch size={16} /> },
    { id: 'database', label: 'Database', icon: <Database size={16} /> },
    { id: 'about', label: 'About', icon: <Info size={16} /> },
  ];

  return (
    <TabbedModal
      title="Settings"
      onClose={closeSettings}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tabId) => setActiveTab(tabId as typeof activeTab)}
    >
      {activeTab === 'appearance' && <AppearanceSettings />}
      {activeTab === 'shortcuts' && <KeyboardShortcutsSettings />}
      {activeTab === 'git' && <GitSettings />}
      {activeTab === 'database' && <DatabaseSettings />}
      {activeTab === 'about' && <AboutSettings />}
    </TabbedModal>
  );
}

function DatabaseSettings() {
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { getStatus, backup, vacuum, checkIntegrity, loading } = useDatabaseAPI();

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    const status = await getStatus();
    setDbStatus(status);
  };

  const handleBackup = async () => {
    setMessage(null);
    const result = await backup();
    if (result) {
      setMessage({
        type: 'success',
        text: `Backup created successfully (${(result.size / 1024 / 1024).toFixed(2)} MB)`,
      });
      await loadStatus();
    } else {
      setMessage({ type: 'error', text: 'Backup failed' });
    }
  };

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

  const formatBytes = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const statusItems = dbStatus
    ? [
        { label: 'Database Size', value: formatBytes(dbStatus.databaseSize) },
        { label: 'Notes', value: dbStatus.noteCount },
        { label: 'Notebooks', value: dbStatus.notebookCount },
        { label: 'Tags', value: dbStatus.tagCount },
      ]
    : [];

  return (
    <SettingsSection title="Database Management">
      <ContainerStack gap="lg">
        {/* Status */}
        {dbStatus && <StatusCard items={statusItems} />}

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
  const { theme, setTheme, accentColor, setAccentColor, showBlockIndicators, toggleBlockIndicators } = useUIStore();

  return (
    <SettingsSection title="Appearance">
      <ContainerStack gap="lg">
        {/* Theme */}
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

        {/* Accent Color */}
        <ContainerStack gap="sm">
          <Label>Accent Color</Label>
          <AccentColorPicker value={accentColor} onChange={setAccentColor} />
        </ContainerStack>

        <Separator />

        {/* Editor Settings */}
        <ContainerStack gap="sm">
          <Label>Editor</Label>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <Body size="sm">Block Indicators</Body>
              <Body size="xs" variant="muted">Show bullet markers on the left of blocks</Body>
            </div>
            <Switch
              checked={showBlockIndicators}
              onCheckedChange={toggleBlockIndicators}
            />
          </div>
        </ContainerStack>

        <Separator />

        {/* Font Settings */}
        <FontSettings />

        <Separator />

        {/* Font Preview */}
        <FontPreview />
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

interface AccentColorPickerProps {
  value: AccentColor;
  onChange: (color: AccentColor) => void;
}

function AccentColorPicker({ value, onChange }: AccentColorPickerProps) {
  const colors = Object.entries(ACCENT_COLORS) as [AccentColor, { name: string; hue: number }][];

  return (
    <div className="flex flex-wrap gap-2">
      {colors.map(([key, { name, hue }]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`w-8 h-8 rounded-full transition-all duration-150 ${
            value === key
              ? 'ring-2 ring-offset-2 ring-offset-popover ring-foreground scale-110'
              : 'hover:scale-105'
          }`}
          style={{ backgroundColor: `hsl(${hue} 70% 50%)` }}
          title={name}
          aria-label={`Select ${name} accent color`}
        />
      ))}
    </div>
  );
}
