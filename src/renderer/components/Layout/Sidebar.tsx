/**
 * Sidebar Component - Navigation and organization
 */

import React, { useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useNotebookStore } from '../../stores/notebookStore';
import { NotebookTree } from '../Notebook/NotebookTree';
import { TagList } from '../Tag/TagList';
import { InputModal } from '../Common/InputModal';
import { Button } from '@renderer/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs';
import { logger } from '../../utils/logger';
import { NotebookWithCount, TagWithCount } from '@shared/types';
import { BookOpen, Tag, Gear, Star, Archive, Clock, Plus } from 'phosphor-react';

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
        <Button
          variant="ghost"
          size="sm"
          onClick={openSettings}
          className="h-8 w-8 p-0"
          title="Settings"
        >
          <Gear size={16} />
        </Button>
      </div>

      {/* Panel Tabs */}
      <Tabs
        value={sidebarPanel}
        onValueChange={(value) => setSidebarPanel(value as 'notebooks' | 'tags' | 'search')}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="notebooks" className="flex items-center gap-2 text-xs">
            <BookOpen size={14} />
            Notebooks
          </TabsTrigger>
          <TabsTrigger value="tags" className="flex items-center gap-2 text-xs">
            <Tag size={14} />
            Tags
          </TabsTrigger>
        </TabsList>

        {/* Quick Links */}
        <div className="p-2 border-b border-border">
          <QuickLink icon={<Star size={14} />} label="Favorites" />
          <QuickLink icon={<Clock size={14} />} label="Recent" />
          <QuickLink icon={<Archive size={14} />} label="Archive" />
        </div>

        {/* Panel Content */}
        <TabsContent value="notebooks" className="flex-1 overflow-y-auto mt-0">
          <NotebookTree />
        </TabsContent>
        <TabsContent value="tags" className="flex-1 overflow-y-auto mt-0">
          <TagList />
        </TabsContent>
      </Tabs>

      {/* New Button */}
      <div className="p-3 border-t border-border">
        <Button onClick={handleNewClick} disabled={isCreating} className="w-full" size="sm">
          <Plus size={16} />
          {isCreating ? 'Creating...' : sidebarPanel === 'notebooks' ? 'New Notebook' : 'New Tag'}
        </Button>
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
    <Button variant="ghost" size="sm" className="w-full justify-start h-8 px-2">
      {icon}
      <span>{label}</span>
    </Button>
  );
}
