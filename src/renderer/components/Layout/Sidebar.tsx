/**
 * Sidebar Component - Navigation and organization
 */

import React, { useState } from 'react';
import { useUIStore } from '@renderer/stores/uiStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { TagList } from '@renderer/components/Tag';
import { InputModal } from '@renderer/components/Common';
import { Button } from '@renderer/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs';
import { Heading3 } from '@renderer/components/ui/text';
import { logger } from '@renderer/utils/logger';
import { TagWithCount } from '@shared/types';
import { Folders, Tag, Gear, Star, Archive, Clock, Plus, ArrowsClockwise } from 'phosphor-react';
import {
  Header,
  IconButton,
  QuickLink,
  PanelFooter,
  SectionHeader,
  ControlGroup,
} from '@renderer/components/composites';
import { useWorkspaceAPI } from '@renderer/hooks/useWorkspaceAPI';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { FileTree } from '@renderer/components/FileSystem/FileTree';
import { WORKSPACE_CHANNELS } from '@shared/constants/ipcChannels';

export function Sidebar() {
  const { sidebarPanel, setSidebarPanel, openSettings } = useUIStore();
  const { loadFileTree } = useFileTreeAPI();
  const { syncWorkspace } = useWorkspaceAPI();
  const { loadNotes } = useNoteAPI();
  const { activeFolder } = useFileTreeStore();
  const [isCreating, setIsCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'folder' | 'tag'>('folder');

  const handleNewFolder = async (name: string) => {
    setIsCreating(true);
    try {
      const response = await window.electron.invoke<{ folderPath: string }>(
        WORKSPACE_CHANNELS.CREATE_FOLDER,
        {
          name,
          parentPath: activeFolder || undefined,
        },
      );

      if (response.success && response.data) {
        logger.info('Folder created:', response.data.folderPath);
        await loadFileTree();
        if (activeFolder) {
          await loadNotes({ folderPath: activeFolder });
        } else {
          await loadNotes();
        }
        setModalOpen(false);
      } else {
        throw new Error(response.error?.message || 'Failed to create folder');
      }
    } catch (error) {
      logger.error('Failed to create folder:', error);
      alert(`Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    if (sidebarPanel === 'folders') {
      setModalType('folder');
    } else if (sidebarPanel === 'tags') {
      setModalType('tag');
    }
    setModalOpen(true);
  };

  const handleModalSubmit = (value: string) => {
    if (modalType === 'folder') {
      handleNewFolder(value);
    } else {
      handleNewTag(value);
    }
  };

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <Header
        left={<Heading3 className="text-sm">Stone</Heading3>}
        right={
          <ControlGroup gap="sm" background="bg-transparent">
            <IconButton
              size="normal"
              icon={<ArrowsClockwise size={13} />}
              label="Sync"
              tooltip="Sync with file system"
        onClick={async () => {
          try {
            const res = await syncWorkspace();
            if (res.success) {
              logger.info('Sync complete', res.data);
              await loadFileTree();
              if (activeFolder) {
                await loadNotes({ folderPath: activeFolder });
              } else {
                await loadNotes();
              }
            } else {
              logger.error('Sync failed', res.error);
              alert(res.error?.message || 'Sync failed');
            }
          } catch (e) {
                  logger.error('Sync error', e);
                  alert('Sync failed');
                }
              }}
            />
            <IconButton
              size="normal"
              icon={<Gear size={13} />}
              label="Settings"
              onClick={openSettings}
            />
          </ControlGroup>
        }
      />

      {/* Panel Tabs - Flex layout */}
      <Tabs
        value={sidebarPanel}
        onValueChange={(value) => setSidebarPanel(value as 'folders' | 'tags' | 'search')}
        className="flex flex-col flex-1 overflow-hidden"
      >
        {/* Tab Triggers - Compact */}
        <TabsList className="grid w-full grid-cols-2 h-8 px-2 py-1 bg-transparent border-b border-border flex-shrink-0">
          <TabsTrigger
            value="folders"
            className="flex items-center justify-center gap-1.5 text-xs h-6 px-2 rounded"
          >
            <Folders size={12} />
            <span className="hidden sm:inline">Folders</span>
          </TabsTrigger>
          <TabsTrigger
            value="tags"
            className="flex items-center justify-center gap-1.5 text-xs h-6 px-2 rounded"
          >
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
          <TabsContent value="folders" className="mt-0 px-1.5 py-1">
            <FileTree />
          </TabsContent>
          <TabsContent value="tags" className="mt-0 px-1.5 py-1">
            <TagList />
          </TabsContent>
        </div>
      </Tabs>

      {/* New Button - Compact footer */}
      <PanelFooter>
        <Button
          onClick={handleNewClick}
          disabled={isCreating}
          className="w-full h-7 text-xs"
          size="sm"
        >
          <Plus size={12} />
          {isCreating ? 'Creating...' : sidebarPanel === 'folders' ? 'New Folder' : 'New Tag'}
        </Button>
      </PanelFooter>

      {/* Input Modal */}
      <InputModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
        title={modalType === 'folder' ? 'Create New Folder' : 'Create New Tag'}
        placeholder={modalType === 'folder' ? 'Enter folder name' : 'Enter tag name'}
        submitLabel="Create"
      />
    </div>
  );
}
