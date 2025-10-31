/**
 * Sidebar Component - Navigation and organization
 */

import React, { useState } from 'react';
import { useUIStore } from '@renderer/stores/uiStore';
import { useNotebookStore } from '@renderer/stores/notebookStore';
import { NotebookTree } from '@renderer/components/Notebook';
import { TagList } from '@renderer/components/Tag';
import { InputModal } from '@renderer/components/Common';
import { Button } from '@renderer/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs';
import { Heading3, Text } from '@renderer/components/ui/text';
import { ContainerFlex, ContainerStack } from '@renderer/components/ui';
import { logger } from '@renderer/utils/logger';
import { NotebookWithCount, TagWithCount } from '@shared/types';
import { BookOpen, Tag, Gear, Star, Archive, Clock, Plus } from 'phosphor-react';
import { Header, IconButton, QuickLink, PanelFooter, SectionHeader } from '@renderer/components/composites';

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
      <Header
        left={<Heading3 className="text-sm">Stone</Heading3>}
        right={
          <IconButton
            size="normal"
            icon={<Gear size={13} />}
            label="Settings"
            onClick={openSettings}
          />
        }
      />

      {/* Panel Tabs - Flex layout */}
      <Tabs
        value={sidebarPanel}
        onValueChange={(value) => setSidebarPanel(value as 'notebooks' | 'tags' | 'search')}
        className="flex flex-col flex-1 overflow-hidden"
      >
        {/* Tab Triggers - Compact */}
        <TabsList className="grid w-full grid-cols-2 h-8 px-2 py-1 bg-transparent border-b border-border flex-shrink-0">
          <TabsTrigger value="notebooks" className="flex items-center justify-center gap-1.5 text-xs h-6 px-2 rounded">
            <BookOpen size={12} />
            <span className="hidden sm:inline">Notebooks</span>
          </TabsTrigger>
          <TabsTrigger value="tags" className="flex items-center justify-center gap-1.5 text-xs h-6 px-2 rounded">
            <Tag size={12} />
            <span className="hidden sm:inline">Tags</span>
          </TabsTrigger>
        </TabsList>

        {/* Quick Links - Minimal */}
        <SectionHeader divided>
          <div className="space-y-0.5">
            <QuickLink icon={<Star size={12} />} label="Favorites" size="compact" />
            <QuickLink icon={<Clock size={12} />} label="Recent" size="compact" />
            <QuickLink icon={<Archive size={12} />} label="Archive" size="compact" />
          </div>
        </SectionHeader>

        {/* Panel Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <TabsContent value="notebooks" className="mt-0 px-1.5 py-1">
            <NotebookTree />
          </TabsContent>
          <TabsContent value="tags" className="mt-0 px-1.5 py-1">
            <TagList />
          </TabsContent>
        </div>
      </Tabs>

      {/* New Button - Compact footer */}
      <PanelFooter>
        <Button onClick={handleNewClick} disabled={isCreating} className="w-full h-7 text-xs" size="sm">
          <Plus size={12} />
          {isCreating ? 'Creating...' : sidebarPanel === 'notebooks' ? 'New Notebook' : 'New Tag'}
        </Button>
      </PanelFooter>

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
