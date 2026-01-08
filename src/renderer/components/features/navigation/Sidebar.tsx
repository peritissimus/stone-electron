/**
 * Sidebar Component - Navigation and organization
 */

import { useState, useEffect, useCallback } from 'react';
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
import { House, CaretLeft, Graph, CheckSquare, Tag, GitBranch, ArrowsClockwise, Check, Warning } from 'phosphor-react';
import {
  QuickLink,
  sizeHeightClasses,
  sizePaddingClasses,
} from '@renderer/components/composites';
import { useWorkspaceAPI } from '@renderer/hooks/useWorkspaceAPI';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';
import { useGitAPI } from '@renderer/hooks/useGitAPI';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useWorkspaceStore } from '@renderer/stores/workspaceStore';
import { FileTree } from '@renderer/components/features/FileSystem';
import { CreateWorkspaceModal } from '@renderer/components/features/Workspace';
import { MLStatusIndicator } from '@renderer/components/features/MLStatus';
import { cn } from '@renderer/lib/utils';
import { events } from '@renderer/lib/events';

/**
 * Git Sync Button - Quick sync status and action in sidebar
 */
function GitSyncButton() {
  const { activeWorkspaceId } = useWorkspaceStore();
  const { status, syncing, getStatus, sync } = useGitAPI();

  // Load git status
  const loadStatus = useCallback(async () => {
    if (!activeWorkspaceId) return;
    await getStatus(activeWorkspaceId);
  }, [activeWorkspaceId, getStatus]);

  // Load status on mount and when workspace changes
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Refresh status on file changes (instead of polling)
  useEffect(() => {
    if (!activeWorkspaceId) return;

    // Refresh git status when files change
    const offCreated = events.onFileCreated(() => loadStatus());
    const offChanged = events.onFileChanged(() => loadStatus());
    const offDeleted = events.onFileDeleted(() => loadStatus());

    return () => {
      offCreated();
      offChanged();
      offDeleted();
    };
  }, [activeWorkspaceId, loadStatus]);

  // Handle sync
  const handleSync = async () => {
    if (!activeWorkspaceId || syncing) return;

    const result = await sync(activeWorkspaceId);
    if (result) {
      logger.info('[GitSyncButton] Sync completed');
      await loadStatus();
    }
  };

  // Don't show if no workspace or not a git repo
  if (!status || !status.isRepo) {
    return null;
  }

  // Calculate total changes
  const totalChanges = status.staged + status.unstaged + status.untracked;
  const hasRemoteChanges = status.ahead > 0 || status.behind > 0;
  const hasLocalChanges = totalChanges > 0;
  const needsSync = hasLocalChanges || hasRemoteChanges;

  return (
    <div className="px-2 py-1.5 border-t border-border">
      <button
        onClick={handleSync}
        disabled={syncing || !status.hasRemote}
        className={cn(
          'flex items-center justify-between w-full px-2 py-1.5 rounded text-xs',
          'hover:bg-accent/50 transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          needsSync && status.hasRemote && 'bg-accent/30'
        )}
        title={
          !status.hasRemote
            ? 'No remote configured - configure in Settings > Git Sync'
            : syncing
              ? 'Syncing...'
              : 'Sync workspace (commit, pull, push)'
        }
      >
        <div className="flex items-center gap-2">
          <GitBranch size={14} className="text-muted-foreground" />
          <span className="text-muted-foreground truncate max-w-[80px]">
            {status.branch || 'main'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Local changes indicator */}
          {hasLocalChanges && (
            <span className="flex items-center gap-0.5 text-amber-500" title={`${totalChanges} local changes`}>
              <Warning size={12} weight="fill" />
              <span>{totalChanges}</span>
            </span>
          )}

          {/* Ahead/behind indicators */}
          {status.hasRemote && status.ahead > 0 && (
            <span className="text-blue-500" title={`${status.ahead} commits to push`}>
              ↑{status.ahead}
            </span>
          )}
          {status.hasRemote && status.behind > 0 && (
            <span className="text-orange-500" title={`${status.behind} commits to pull`}>
              ↓{status.behind}
            </span>
          )}

          {/* Sync status icon */}
          {syncing ? (
            <ArrowsClockwise size={14} className="animate-spin text-primary" />
          ) : needsSync && status.hasRemote ? (
            <ArrowsClockwise size={14} className="text-primary" />
          ) : status.hasRemote ? (
            <Check size={14} className="text-green-500" />
          ) : null}
        </div>
      </button>
    </div>
  );
}

export function Sidebar() {
  const { loadFileTree } = useFileTreeAPI();
  const { loadWorkspaces, setActiveWorkspace, createWorkspace } = useWorkspaceAPI();
  const { loadNotes, loadNoteById } = useNoteAPI();
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
        // Fetch updated note details using hook
        const updatedNote = await loadNoteById(note.id);
        if (updatedNote) {
          updateNoteByPath(payload.path, updatedNote);
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

    const offCreated = events.onFileCreated(handleFileCreated);
    const offChanged = events.onFileChanged(handleFileChanged);
    const offDeleted = events.onFileDeleted(handleFileDeleted);
    const offWorkspaceUpdated = events.onWorkspaceUpdated(handleWorkspaceUpdated);
    const offNoteUpdated = events.onNoteUpdated(handleNoteUpdated);

    return () => {
      offCreated();
      offChanged();
      offDeleted();
      offWorkspaceUpdated();
      offNoteUpdated();
    };
  }, [activeFolder, loadFileTree, loadNotes, loadNoteById]);

  const handleCreateWorkspace = async ({
    name,
    folderPath,
  }: {
    name: string;
    folderPath: string;
  }) => {
    setIsWorkspaceModalProcessing(true);
    try {
      const createdWorkspace = await createWorkspace({ name, path: folderPath });

      if (!createdWorkspace) {
        throw new Error('Failed to create workspace');
      }

      logger.info('Workspace created:', createdWorkspace.name);

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
        <QuickLink
          icon={<Tag size={14} />}
          label="Topics"
          onClick={() => {
            setActiveNote(null);
            setActivePage('topics');
          }}
          isActive={!activeNoteId && activePage === 'topics'}
        />
      </div>

      {/* File Tree - Scrollable */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1">
        <FileTree />
      </div>

      {/* Git Sync Status */}
      <GitSyncButton />

      {/* ML Status Indicator */}
      <MLStatusIndicator />

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
