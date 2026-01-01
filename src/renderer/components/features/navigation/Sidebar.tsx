/**
 * Sidebar Component - Navigation and organization
 */

import { useState, useEffect } from 'react';
import { useUIStore } from '@renderer/stores/uiStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useNoteStore } from '@renderer/stores/noteStore';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/base/ui/select';
import { Text } from '@renderer/components/base/ui/text';
import { logger } from '@renderer/utils/logger';
import { type Workspace, type Note } from '@shared/types';
import { House, CaretLeft, Graph, CheckSquare } from 'phosphor-react';
import {
  QuickLink,
  sizeHeightClasses,
  sizePaddingClasses,
} from '@renderer/components/composites';
import { useWorkspaceAPI } from '@renderer/hooks/useWorkspaceAPI';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useWorkspaceStore } from '@renderer/stores/workspaceStore';
import { FileTree } from '@renderer/components/features/FileSystem';
import { CreateWorkspaceModal } from '@renderer/components/features/Workspace';
import { WORKSPACE_CHANNELS, EVENTS } from '@shared/constants/ipcChannels';
import { cn } from '@renderer/lib/utils';

export function Sidebar() {
  const { loadFileTree } = useFileTreeAPI();
  const { loadWorkspaces, setActiveWorkspace } = useWorkspaceAPI();
  const { loadNotes } = useNoteAPI();
  const { setActiveNote, activeNoteId } = useNoteStore();
  const { activeFolder } = useFileTreeStore();
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
  const { toggleSidebar, activePage, setActivePage } = useUIStore();
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [isWorkspaceModalProcessing, setIsWorkspaceModalProcessing] = useState(false);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  // Listen to workspace file changes with targeted updates
  useEffect(() => {
    const { addFileToTree, removeFileFromTree, updateFileInTree } = useFileTreeStore.getState();
    const {
      updateNoteByPath,
      removeNoteByPath,
      getNoteByFilePath,
      updateNote: updateNoteInStore,
    } = useNoteStore.getState();

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

  const CREATE_WORKSPACE_OPTION = '__create__';

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Workspace Selector with Collapse Button */}
      <div
        className={cn(
          'flex w-full items-center gap-1 border-b border-border',
          sizeHeightClasses['spacious'],
          sizePaddingClasses['compact'],
        )}
      >
        <Select
          value={activeWorkspaceId ?? ''}
          onValueChange={async (value) => {
            if (value === CREATE_WORKSPACE_OPTION) {
              setWorkspaceModalOpen(true);
              return;
            }
            if (!value) {
              return;
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
                      <Text size="xs">{workspace.name}</Text>
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectSeparator />
              </>
            )}
            <SelectItem value={CREATE_WORKSPACE_OPTION}>
              <Text size="xs">+ Create workspace…</Text>
            </SelectItem>
          </SelectContent>
        </Select>
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-6 h-6 rounded hover:bg-accent/50 transition-colors"
          title="Collapse sidebar"
        >
          <CaretLeft size={14} weight="bold" />
        </button>
      </div>

      {/* Navigation Links - Always visible */}
      <div className="px-2 py-2 border-b border-border space-y-0.5">
        <QuickLink
          icon={<House size={14} />}
          label="Home"
          onClick={() => {
            setActiveNote(null);
            setActivePage('home');
          }}
          isActive={!activeNoteId && activePage === 'home'}
        />
        <QuickLink
          icon={<CheckSquare size={14} />}
          label="Tasks"
          onClick={() => {
            setActiveNote(null);
            setActivePage('tasks');
          }}
          isActive={!activeNoteId && activePage === 'tasks'}
        />
        <QuickLink
          icon={<Graph size={14} />}
          label="Graph"
          onClick={() => {
            setActiveNote(null);
            setActivePage('graph');
          }}
          isActive={!activeNoteId && activePage === 'graph'}
        />
      </div>

      {/* File Tree - Scrollable */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1">
        <FileTree />
      </div>

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
