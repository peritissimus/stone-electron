/**
 * Settings Modal Component
 */

import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import {
  X,
  Database,
  HardDrive,
  Download,
  Upload,
  Trash2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { DATABASE_CHANNELS } from '@shared/constants/ipcChannels';
import { DatabaseStatus, BackupResult, VacuumResult, IntegrityResult } from '@shared/types';
import { logger } from '../../utils/logger';

export function SettingsModal() {
  const { settingsOpen, closeSettings } = useUIStore();
  const [activeTab, setActiveTab] = useState<'database' | 'appearance' | 'about'>('database');

  if (!settingsOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">Settings</h2>
          <button
            onClick={closeSettings}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex h-[600px]">
          {/* Sidebar */}
          <div className="w-48 border-r border-border p-4">
            <button
              onClick={() => setActiveTab('database')}
              className={`w-full text-left px-3 py-2 rounded-lg mb-2 transition-colors ${
                activeTab === 'database'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Database size={16} className="inline mr-2" />
              Database
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full text-left px-3 py-2 rounded-lg mb-2 transition-colors ${
                activeTab === 'appearance'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Appearance
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'about'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              About
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'database' && <DatabaseSettings />}
            {activeTab === 'appearance' && <AppearanceSettings />}
            {activeTab === 'about' && <AboutSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}

function DatabaseSettings() {
  const [status, setStatus] = useState<any>(null);
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

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Database Management
      </h3>

      {/* Status */}
      {status && (
        <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Database Size:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {formatBytes(status.database_size)}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Notes:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {status.note_count}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Notebooks:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {status.notebook_count}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Tags:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {status.tag_count}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'
          }`}
        >
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-4">
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Create Backup</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Create a backup of your database
              </p>
            </div>
            <button
              onClick={handleBackup}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Download size={16} />
              Backup
            </button>
          </div>
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                Optimize Database
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Reclaim space and improve performance
              </p>
            </div>
            <button
              onClick={handleVacuum}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <HardDrive size={16} />
              Optimize
            </button>
          </div>
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Check Integrity</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Verify database integrity</p>
            </div>
            <button
              onClick={handleCheckIntegrity}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <CheckCircle size={16} />
              Check
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppearanceSettings() {
  const { theme, setTheme } = useUIStore();

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Appearance</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Theme
          </label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function AboutSettings() {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">About Stone</h3>

      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🪨</div>
          <h4 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Stone</h4>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Version 0.1.0</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            A production-ready note-taking application built with Electron, React, and TypeScript.
            Features comprehensive database management, full-text search, and rich text editing.
          </p>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Technology Stack</h5>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• Electron 27 - Desktop application framework</li>
            <li>• React 18 - UI library</li>
            <li>• TypeScript - Type-safe development</li>
            <li>• Better-SQLite3 - Database engine</li>
            <li>• TipTap - Rich text editor</li>
            <li>• Tailwind CSS - Styling framework</li>
            <li>• Zustand - State management</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
