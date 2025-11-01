/**
 * Sidebar Component - Navigation and organization
 */

import React, { useState, useEffect } from 'react';
import { useUIStore } from '@renderer/stores/uiStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useNoteStore } from '@renderer/stores/noteStore';
import { TagList } from '@renderer/components/Tag';
import { Button } from '@renderer/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';
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
import { InputModal } from '@renderer/components/Common';
import { useWorkspaceAPI } from '@renderer/hooks/useWorkspaceAPI';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useWorkspaceStore } from '@renderer/stores/workspaceStore';
import { FileTree } from '@renderer/components/FileSystem/FileTree';
import { WORKSPACE_CHANNELS, EVENTS } from '@shared/constants/ipcChannels';

export function Sidebar() {
  const { sidebarPanel, setSidebarPanel, openSettings } = useUIStore();
  const { loadFileTree } = useFileTreeAPI();
  const { syncWorkspace, loadWorkspaces, setActiveWorkspace } = useWorkspaceAPI();
  const { loadNotes, createNote } = useNoteAPI();
  const { setActiveNote } = useNoteStore();
  const { activeFolder } = useFileTreeStore();
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
  const [isCreating, setIsCreating] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  // Listen to workspace file changes and refresh tree/notes
  useEffect(() => {
    const refresh = async () => {
      await loadFileTree();
      if (activeFolder) {
        await loadNotes({ folderPath: activeFolder });
      } else {
        await loadNotes();
      }
    };

    const offCreated = window.electron.on(EVENTS.FILE_CREATED, refresh);
    const offChanged = window.electron.on(EVENTS.FILE_CHANGED, refresh);
    const offDeleted = window.electron.on(EVENTS.FILE_DELETED, refresh);
    const offWorkspaceUpdated = window.electron.on(EVENTS.WORKSPACE_UPDATED, refresh);

    return () => {
      offCreated?.();
      offChanged?.();
      offDeleted?.();
      offWorkspaceUpdated?.();
    };
  }, [activeFolder, loadFileTree, loadNotes]);

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);

  const handleNewTag = async (name: string) => {
    setIsCreating(true);
    try {
      const response = await window.electron.invoke<TagWithCount>('tags:create', {
        name,
      });

      if (response.success && response.data) {
        logger.info('Tag created:', response.data.name);
        setTagModalOpen(false);
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

  const handleNewWorkspace = async (name: string) => {
    setIsCreating(true);
    try {
      const folderResponse = await window.electron.invoke<{ canceled?: boolean; folderPath?: string }>(
        WORKSPACE_CHANNELS.SELECT_FOLDER,
        undefined,
      );

      if (!folderResponse.success || folderResponse.data?.canceled || !folderResponse.data?.folderPath) {
        setIsCreating(false);
        return;
      }

      const response = await window.electron.invoke<{ name: string }>(WORKSPACE_CHANNELS.CREATE, {
        name,
        folderPath: folderResponse.data.folderPath,
      });

      if (response.success) {
        logger.info('Workspace created:', response.data?.name ?? name);
        await loadWorkspaces();
        await loadFileTree();
        await loadNotes();
        setWorkspaceModalOpen(false);
      } else {
        throw new Error(response.error?.message || 'Failed to create workspace');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('cancel')) {
        return;
      }
      logger.error('Failed to create workspace:', error);
      alert(`Failed to create workspace: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateNote = async () => {
    if (isCreating) return;

    setIsCreating(true);
    try {
      const note = await createNote({
        title: '',
        content: '',
        folderPath: activeFolder || undefined,
      });

      if (note) {
        setActiveNote(note.id);
        await loadFileTree();
        await loadNotes({ folderPath: activeFolder || undefined });
      }
    } catch (error) {
      logger.error('Failed to create note:', error);
      alert('Failed to create note. Please try again.');
    } finally {
      setIsCreating(false);
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
              icon={<Plus size={13} />}
              label="New Note"
              tooltip="Create new note"
              onClick={handleCreateNote}
              disabled={isCreating}
            />
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
                    await loadWorkspaces();
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

      <div className="px-3 py-2 border-b border-border">
        <div className="flex flex-col gap-1">
          <Heading3 className="text-sm">Workspace</Heading3>
          <Select
            value={activeWorkspaceId ?? ''}
            onValueChange={async (value) => {
              await setActiveWorkspace(value);
              await loadFileTree();
              await loadNotes();
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select workspace" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeWorkspace?.folderPath && (
            <p className="text-[10px] text-muted-foreground truncate">
              {activeWorkspace.folderPath}
            </p>
          )}
        </div>
      </div>

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
          onClick={() => {
            if (sidebarPanel === 'folders') {
              setWorkspaceModalOpen(true);
            } else if (sidebarPanel === 'tags') {
              setTagModalOpen(true);
            }
          }}
          disabled={isCreating}
          className="w-full h-7 text-xs"
          size="sm"
        >
          <Plus size={12} />
          {isCreating
            ? 'Creating...'
            : sidebarPanel === 'folders'
              ? 'New Workspace'
              : 'New Tag'}
        </Button>
      </PanelFooter>

      <InputModal
        isOpen={tagModalOpen}
        onClose={() => setTagModalOpen(false)}
        onSubmit={handleNewTag}
        title="Create New Tag"
        placeholder="Enter tag name"
        submitLabel="Create"
      />
      <InputModal
        isOpen={workspaceModalOpen}
        onClose={() => setWorkspaceModalOpen(false)}
        onSubmit={handleNewWorkspace}
        title="Create New Workspace"
        placeholder="Workspace name"
        submitLabel="Continue"
      />
    </div>
  );

}
