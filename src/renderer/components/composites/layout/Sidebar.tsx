/**
 * Sidebar Component - pure composition of header + navigation + tree + status.
 *
 * Also hosts the keyboard-nav surface: the root div is focusable (tabindex=-1)
 * and its onKeyDown is the modal vim-style handler (j/k/h/l/o/Enter/Esc).
 * An effect consumes the sidebarFocusStore's pendingFocus flag so the
 * focusSidebar shortcut can move DOM focus here even if the sidebar was
 * just opened from collapsed.
 */

import { useEffect, useRef } from 'react';
import { FileTree } from '@renderer/components/features/FileSystem';
import { useSidebarFocusHandoff } from '@renderer/hooks/useSidebarFocusHandoff';
import { useSidebarKeyboardNav } from '@renderer/hooks/useSidebarKeyboardNav';
import { WorkspaceSelectorHeader } from './WorkspaceSelectorHeader';
import { SidebarNavList } from './SidebarNavList';
import { SidebarStatusRail } from './SidebarStatusRail';

export function Sidebar() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { pendingFocus, acknowledgeFocus } = useSidebarFocusHandoff();
  const { handleKeyDown } = useSidebarKeyboardNav();

  useEffect(() => {
    if (!pendingFocus) return;
    containerRef.current?.focus();
    acknowledgeFocus();
  }, [pendingFocus, acknowledgeFocus]);

  return (
    <div
      ref={containerRef}
      role="navigation"
      aria-label="Sidebar"
      tabIndex={-1}
      data-sidebar-root="true"
      onKeyDown={handleKeyDown}
      className="flex flex-col h-full bg-sidebar outline-none"
    >
      <WorkspaceSelectorHeader />
      <SidebarNavList />
      <div className="flex-1 overflow-y-auto px-1.5 py-1">
        <FileTree />
      </div>
      <SidebarStatusRail />
    </div>
  );
}
