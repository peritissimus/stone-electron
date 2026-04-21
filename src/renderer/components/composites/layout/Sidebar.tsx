/**
 * Sidebar Component - pure composition of header + navigation + tree + status.
 *
 * No side effects here: data loading and event subscriptions live at the app
 * root (MainLayout). Sidebar only renders.
 */

import { FileTree } from '@renderer/components/features/FileSystem';
import { WorkspaceSelectorHeader } from './WorkspaceSelectorHeader';
import { SidebarNavList } from './SidebarNavList';
import { SidebarStatusRail } from './SidebarStatusRail';

export function Sidebar() {
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
