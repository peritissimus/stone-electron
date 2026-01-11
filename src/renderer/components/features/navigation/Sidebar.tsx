/**
 * Sidebar Component - Navigation and organization
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useUI } from '@renderer/hooks/useUI';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
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
import { House, CaretLeft, Graph, CheckSquare, Tag } from 'phosphor-react';
import { QuickLink, sizeHeightClasses, sizePaddingClasses } from '@renderer/components/composites';
import { useWorkspaceAPI } from '@renderer/hooks/useWorkspaceAPI';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useWorkspaceStore } from '@renderer/stores/workspaceStore';
import { useSidebarEvents } from '@renderer/hooks/useSidebarEvents';
import { FileTree } from '@renderer/components/features/FileSystem';
import { CreateWorkspaceModal } from '@renderer/components/features/Workspace';
import { MLStatusIndicator } from '@renderer/components/features/MLStatus';
import { GitSyncButton } from './GitSyncButton';
import { cn } from '@renderer/lib/utils';

const CREATE_WORKSPACE_OPTION = '__create__';

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const { loadFileTree } = useFileTreeAPI();
  const { loadWorkspaces, setActiveWorkspace, createWorkspace } = useWorkspaceAPI();
  const { loadNotes } = useNoteAPI();
  const { activeFolder } = useFileTreeStore();
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
  const { toggleSidebar } = useUI();

  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [isWorkspaceModalProcessing, setIsWorkspaceModalProcessing] = useState(false);

  // Determine active page from current route
  const currentPath = location.pathname;
  const isNotePage = currentPath.startsWith('/note/');

  // Subscribe to file/workspace/note events
  useSidebarEvents({ activeFolder });

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const handleWorkspaceChange = async (value: string) => {
    if (value === CREATE_WORKSPACE_OPTION) {
      setWorkspaceModalOpen(true);
      return;
    }
    if (!value) return;

    await setActiveWorkspace(value);
    await loadFileTree();
    await loadNotes();
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
      toast.error(
        `Failed to create workspace: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsWorkspaceModalProcessing(false);
    }
  };

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
        <Select value={activeWorkspaceId ?? ''} onValueChange={handleWorkspaceChange}>
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

      {/* Navigation Links */}
      <div className="px-2 py-2 border-b border-border space-y-0.5">
        <QuickLink
          icon={<House size={14} />}
          label="Home"
          onClick={() => navigate('/home')}
          isActive={!isNotePage && currentPath === '/home'}
        />
        <QuickLink
          icon={<CheckSquare size={14} />}
          label="Tasks"
          onClick={() => navigate('/tasks')}
          isActive={!isNotePage && currentPath === '/tasks'}
        />
        <QuickLink
          icon={<Graph size={14} />}
          label="Graph"
          onClick={() => navigate('/graph')}
          isActive={!isNotePage && currentPath === '/graph'}
        />
        <QuickLink
          icon={<Tag size={14} />}
          label="Topics"
          onClick={() => navigate('/topics')}
          isActive={!isNotePage && currentPath === '/topics'}
        />
      </div>

      {/* File Tree */}
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
