/**
 * Sidebar Component - Navigation and organization
 */

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUI } from '@renderer/hooks/useUI';
import { Text } from '@renderer/components/base/ui/text';
import { House, CaretLeft, Graph, CheckSquare, Tag } from 'phosphor-react';
import { QuickLink, sizeHeightClasses, sizePaddingClasses } from '@renderer/components/composites';
import { useWorkspaceAPI } from '@renderer/hooks/useWorkspaceAPI';
import { useFileTree } from '@renderer/hooks/useFileTree';
import { useWorkspaces } from '@renderer/hooks/useWorkspaces';
import { useSidebarEvents } from '@renderer/hooks/useSidebarEvents';
import { FileTree } from '@renderer/components/features/FileSystem';
import { MLStatusIndicator } from '@renderer/components/features/MLStatus';
import { GitSyncButton } from './GitSyncButton';
import { cn } from '@renderer/lib/utils';

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const { loadWorkspaces } = useWorkspaceAPI();
  const { activeFolder } = useFileTree();
  const { workspaces, activeWorkspaceId } = useWorkspaces();
  const { toggleSidebar } = useUI();

  // Determine active page from current route
  const currentPath = location.pathname;
  const isNotePage = currentPath.startsWith('/note/');

  // Subscribe to file/workspace/note events
  useSidebarEvents({ activeFolder });

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const activeWorkspaceName = workspaces.find((w) => w.id === activeWorkspaceId)?.name;

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
        <div className="flex-1 px-2">
          <Text size="sm" weight="medium" className="truncate">
            {activeWorkspaceName || 'Select workspace'}
          </Text>
        </div>
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
    </div>
  );
}
