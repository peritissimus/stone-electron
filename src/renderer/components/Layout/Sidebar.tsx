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
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';
import { Heading3, Text } from '@renderer/components/ui/text';
import { logger } from '@renderer/utils/logger';
import { TagWithCount, type Workspace, type Note } from '@shared/types';
import { Folders, Tag, Gear, Star, Archive, Clock, Plus, ArrowsClockwise } from 'phosphor-react';
import {
  Header,
  IconButton,
  QuickLink,
  PanelFooter,
  SectionHeader,
  ControlGroup,
  sizeHeightClasses,
  sizePaddingClasses,
} from '@renderer/components/composites';
import { InputModal } from '@renderer/components/Common';
import { useWorkspaceAPI } from '@renderer/hooks/useWorkspaceAPI';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useWorkspaceStore } from '@renderer/stores/workspaceStore';
import { FileTree } from '@renderer/components/FileSystem/FileTree';
import { CreateWorkspaceModal } from '@renderer/components/Workspace/CreateWorkspaceModal';
import { WORKSPACE_CHANNELS, EVENTS } from '@shared/constants/ipcChannels';
import { cn } from '@/renderer/lib/utils';

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
  const [isWorkspaceModalProcessing, setIsWorkspaceModalProcessing] = useState(false);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  // Listen to workspace file changes with targeted updates
  useEffect(() => {
    const { addFileToTree, removeFileFromTree, updateFileInTree } = useFileTreeStore.getState();
    const { updateNoteByPath, removeNoteByPath, getNoteByFilePath, updateNote: updateNoteInStore } = useNoteStore.getState();

    // Handler for file created
    const handleFileCreated = async (...args: unknown[]) => {
      const payload = args[0] as { workspaceId: string; path: string };
      logger.debug('[Sidebar] FILE_CREATED:', payload.path);

      // Add to tree optimistically
      const segments = payload.path.split('/');
      const name = segments[segments.length - 1].replace(/\.md$/, '');
      addFileToTree(payload.path, {
        name,
        path: payload.path,
        type: 'file',
      });

      // Reload notes for the current folder to pick up the new note
      if (activeFolder) {
        await loadNotes({ folderPath: activeFolder });
      } else {
        await loadNotes();
      }
    };

    // Handler for file changed
    const handleFileChanged = async (...args: unknown[]) => {
      const payload = args[0] as { workspaceId: string; path: string };
      logger.debug('[Sidebar] FILE_CHANGED:', payload.path);

      // Update note in store if it exists
      const note = getNoteByFilePath(payload.path);
      if (note) {
        // Fetch updated note details
        try {
          const response = await window.electron.invoke<Note>('notes:get', { id: note.id });
          if (response.success && response.data) {
            updateNoteByPath(payload.path, response.data);
          }
        } catch (error) {
          logger.error('[Sidebar] Error fetching updated note:', error);
        }
      }
    };

    // Handler for file deleted
    const handleFileDeleted = (...args: unknown[]) => {
      const payload = args[0] as { workspaceId: string; path: string };
      logger.debug('[Sidebar] FILE_DELETED:', payload.path);

      // Remove from tree and notes
      removeFileFromTree(payload.path);
      removeNoteByPath(payload.path);
    };

    // Handler for full workspace sync (fallback for complex operations)
    const handleWorkspaceUpdated = async () => {
      logger.debug('[Sidebar] WORKSPACE_UPDATED - full refresh');
      await loadFileTree();
      if (activeFolder) {
        await loadNotes({ folderPath: activeFolder });
      } else {
        await loadNotes();
      }
    };

    // Handler for note updated (to catch file path changes from title updates)
    const handleNoteUpdated = (...args: unknown[]) => {
      const payload = args[0] as { note: Note };
      logger.debug('[Sidebar] NOTE_UPDATED:', payload.note);

      // Update note in store
      if (payload.note) {
        updateNoteInStore(payload.note);
      }
    };

    const offCreated = window.electron.on(EVENTS.FILE_CREATED, handleFileCreated);
    const offChanged = window.electron.on(EVENTS.FILE_CHANGED, handleFileChanged);
    const offDeleted = window.electron.on(EVENTS.FILE_DELETED, handleFileDeleted);
    const offWorkspaceUpdated = window.electron.on(
      EVENTS.WORKSPACE_UPDATED,
      handleWorkspaceUpdated,
    );
    const offNoteUpdated = window.electron.on(EVENTS.NOTE_UPDATED, handleNoteUpdated);

    return () => {
      offCreated?.();
      offChanged?.();
      offDeleted?.();
      offWorkspaceUpdated?.();
      offNoteUpdated?.();
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

  const handleCreateWorkspace = async ({
    name,
    folderPath,
  }: {
    name: string;
    folderPath: string;
  }) => {
    setIsWorkspaceModalProcessing(true);
    try {
      const response = await window.electron.invoke<Workspace>(WORKSPACE_CHANNELS.CREATE, {
        name,
        folderPath,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to create workspace');
      }

      const createdWorkspace = response.data;
      logger.info('Workspace created:', createdWorkspace.name);

      await loadWorkspaces();
      if (createdWorkspace.id) {
        await setActiveWorkspace(createdWorkspace.id);
      }
      await loadFileTree();
      await loadNotes();
      setWorkspaceModalOpen(false);
    } catch (error) {
      logger.error('Failed to create workspace:', error);
      alert(
        `Failed to create workspace: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsWorkspaceModalProcessing(false);
    }
  };

  const handleCreateNote = async () => {
    if (isCreating) return;

    setIsCreating(true);
    try {
      // Generate a default title for the new note
      const now = new Date();
      const defaultTitle = `Note ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

      const note = await createNote({
        title: defaultTitle,
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

  const CREATE_WORKSPACE_OPTION = '__create__';

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className={cn("flex w-full items-center border-b border-border", sizeHeightClasses['spacious'], sizePaddingClasses['compact']) }>
          <div className="flex items-center gap-2 w-full">
            <Select
              value={activeWorkspaceId ?? ''}
              onValueChange={async (value) => {
                if (value === CREATE_WORKSPACE_OPTION) {
                  setWorkspaceModalOpen(true);
                  return;
                }
                if (!value) {
                  return
                }
                await setActiveWorkspace(value);
                await loadFileTree();
                await loadNotes();
              }}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.length > 0 && (
                  <>
                    <SelectGroup>
                      {workspaces.map((workspace) => (
                        <SelectItem key={workspace.id} value={workspace.id}>
                          <Text size="xs">
                            {workspace.name}
                          </Text>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectSeparator />
                  </>
                )}
                <SelectItem value={CREATE_WORKSPACE_OPTION}>
                  <Text size="xs">
                  + Create workspace…
                  </Text>
                </SelectItem>
              </SelectContent>
            </Select>
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
      {sidebarPanel === 'tags' && (
        <PanelFooter>
          <Button
            onClick={() => setTagModalOpen(true)}
            disabled={isCreating}
            className="w-full h-7 text-xs"
            size="sm"
          >
            <Plus size={12} />
            {isCreating ? 'Creating...' : 'New Tag'}
          </Button>
        </PanelFooter>
      )}

      <InputModal
        isOpen={tagModalOpen}
        onClose={() => setTagModalOpen(false)}
        onSubmit={handleNewTag}
        title="Create New Tag"
        placeholder="Enter tag name"
        submitLabel="Create"
      />
      <CreateWorkspaceModal
        isOpen={workspaceModalOpen}
        isSubmitting={isWorkspaceModalProcessing}
        onClose={() => {
          if (isWorkspaceModalProcessing) return;
          setWorkspaceModalOpen(false);
        }}
        onSubmit={handleCreateWorkspace}
      />
    </div>
  );
}
