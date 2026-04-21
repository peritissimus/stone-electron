/**
 * Sidebar Component - composes navigation, file tree, and status rail
 */

import { useEffect } from 'react';
import { useWorkspaceAPI } from '@renderer/hooks/useWorkspaceAPI';
import { useFileTree } from '@renderer/hooks/useFileTree';
import { useSidebarEvents } from '@renderer/hooks/useSidebarEvents';
import { FileTree } from '@renderer/components/features/FileSystem';
import { WorkspaceSelectorHeader } from './WorkspaceSelectorHeader';
import { SidebarNavList } from './SidebarNavList';
import { SidebarStatusRail } from './SidebarStatusRail';

export function Sidebar() {
  const { loadWorkspaces } = useWorkspaceAPI();
  const { activeFolder } = useFileTree();

  useSidebarEvents({ activeFolder });

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <WorkspaceSelectorHeader />
      <SidebarNavList />
      <div className="flex-1 overflow-y-auto px-1.5 py-1">
        <FileTree />
      </div>
      <SidebarStatusRail />
    </div>
  );
}
