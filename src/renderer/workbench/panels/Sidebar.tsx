/**
 * Sidebar Component - pure composition of header + navigation + tree + status.
 *
 * Also hosts the keyboard-nav surface: the root nav is focusable (tabindex=-1)
 * and its onKeyDown is the modal vim-style handler (j/k/h/l/o/Enter/Esc).
 * An effect consumes the sidebarFocusStore's pendingFocus flag so the
 * focusSidebar shortcut can move DOM focus here even if the sidebar was
 * just opened from collapsed.
 */

import { useEffect, useRef } from 'react';
import { FileTree } from '@renderer/workbench/panels/file-tree';
import { useSidebarFocusHandoff } from '@renderer/services/view-state/hooks/useSidebarFocusHandoff';
import { useSidebarKeyboardNav } from '@renderer/services/workspace/hooks/useSidebarKeyboardNav';
import { SidebarNavList } from './SidebarNavList';
import { SidebarStatusRail } from './SidebarStatusRail';

export function Sidebar() {
  const containerRef = useRef<HTMLElement | null>(null);
  const { pendingFocus, acknowledgeFocus } = useSidebarFocusHandoff();
  const { handleKeyDown } = useSidebarKeyboardNav();

  useEffect(() => {
    if (!pendingFocus) return;
    containerRef.current?.focus();
    acknowledgeFocus();
  }, [pendingFocus, acknowledgeFocus]);

  return (
    <nav
      ref={containerRef}
      aria-label="Sidebar"
      tabIndex={-1}
      data-sidebar-root="true"
      onKeyDown={handleKeyDown}
      className="relative flex h-full flex-col bg-sidebar outline-none"
    >
      <div className="h-10 shrink-0 border-b border-border/70" />
      <SidebarNavList />
      <div className="mx-3 h-px bg-border/55" />
      <div className="flex-1 overflow-y-auto px-2 pb-2 pt-3">
        <FileTree />
      </div>
      <SidebarStatusRail />
    </nav>
  );
}
