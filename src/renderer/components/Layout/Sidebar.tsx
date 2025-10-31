/**
 * Sidebar Component - Navigation and organization
 */

import React, { useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useNotebookStore } from '../../stores/notebookStore';
import { NotebookTree } from '../Notebook/NotebookTree';
import { TagList } from '../Tag/TagList';
import { InputModal } from '../Common/InputModal';
import { logger } from '../../utils/logger';
import { NotebookWithCount, TagWithCount, IpcResponse } from '@shared/types';
import { BookOpen, Tag, Search, Settings, Star, Archive, Clock, Plus } from 'lucide-react';

export function Sidebar() {
  const { sidebarPanel, setSidebarPanel, openSettings } = useUIStore();
  const { addNotebook } = useNotebookStore();
  const [isCreating, setIsCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'notebook' | 'tag'>('notebook');

  const handleNewNotebook = async (name: string) => {
    setIsCreating(true);
    try {
      const response = await window.electron.invoke<NotebookWithCount>('notebooks:create', {
        name,
      });

      logger.info('Create notebook response:', response);

      if (response.success && response.data) {
        // Update local store
        addNotebook(response.data);
        logger.info('Notebook created:', response.data.name);
        setModalOpen(false);
      } else {
        const errorMsg = response.error?.message || 'Failed to create notebook';
        logger.error('Backend error:', response.error);
        throw new Error(errorMsg);
      }
    } catch (error) {
      logger.error('Failed to create notebook:', error);
      alert(
        `Failed to create notebook: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleNewTag = async (name: string) => {
    setIsCreating(true);
    try {
      const response = await window.electron.invoke<TagWithCount>('tags:create', {
        name,
      });

      if (response.success && response.data) {
        logger.info('Tag created:', response.data.name);
        setModalOpen(false);
      } else {
        throw new Error('Failed to create tag');
      }
    } catch (error) {
      logger.error('Failed to create tag:', error);
      alert('Failed to create tag. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleNewClick = () => {
    if (sidebarPanel === 'notebooks') {
      setModalType('notebook');
    } else if (sidebarPanel === 'tags') {
      setModalType('tag');
    }
    setModalOpen(true);
  };

  const handleModalSubmit = (value: string) => {
    if (modalType === 'notebook') {
      handleNewNotebook(value);
    } else {
      handleNewTag(value);
    }
  };

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-titlebar pb-3 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Stone</h1>
        <button
          onClick={openSettings}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Panel Tabs */}
      <div className="flex border-b border-border bg-sidebar/50">
        <button
          onClick={() => setSidebarPanel('notebooks')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium transition-all ${
            sidebarPanel === 'notebooks'
              ? 'text-primary bg-accent'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <BookOpen size={14} />
          Notebooks
        </button>
        <button
          onClick={() => setSidebarPanel('tags')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium transition-all ${
            sidebarPanel === 'tags'
              ? 'text-primary bg-accent'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Tag size={14} />
          Tags
        </button>
      </div>

      {/* Quick Links */}
      <div className="p-2 border-b border-border">
        <QuickLink icon={<Star size={14} />} label="Favorites" />
        <QuickLink icon={<Clock size={14} />} label="Recent" />
        <QuickLink icon={<Archive size={14} />} label="Archive" />
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto">
        {sidebarPanel === 'notebooks' && <NotebookTree />}
        {sidebarPanel === 'tags' && <TagList />}
      </div>

      {/* New Button */}
      <div className="p-3 border-t border-border">
        <button
          onClick={handleNewClick}
          disabled={isCreating}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-lg text-xs font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <Plus size={16} />
          {isCreating ? 'Creating...' : sidebarPanel === 'notebooks' ? 'New Notebook' : 'New Tag'}
        </button>
      </div>

      {/* Input Modal */}
      <InputModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
        title={modalType === 'notebook' ? 'Create New Notebook' : 'Create New Tag'}
        placeholder={modalType === 'notebook' ? 'Enter notebook name' : 'Enter tag name'}
        submitLabel="Create"
      />
    </div>
  );
}

interface QuickLinkProps {
  icon: React.ReactNode;
  label: string;
}

function QuickLink({ icon, label }: QuickLinkProps) {
  return (
    <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground text-xs transition-colors">
      {icon}
      <span>{label}</span>
    </button>
  );
}
