/**
 * Sidebar Component - pure composition of header + navigation + tree + status.
 *
 * The file tree owns a tab stop and announces its keyboard cursor through
 * aria-activedescendant. Navigation links and row actions keep their own keys.
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { pendingFocus, acknowledgeFocus } = useSidebarFocusHandoff();
  const { handleKeyDown, handleFocus, activeDescendantId } = useSidebarKeyboardNav();

  useEffect(() => {
    if (!pendingFocus) return;
    containerRef.current?.focus();
    acknowledgeFocus();
  }, [pendingFocus, acknowledgeFocus]);

  return (
    <nav
      aria-label="Sidebar"
      data-sidebar-root="true"
      className="relative flex h-full flex-col bg-sidebar outline-none"
    >
      <div className="h-10 shrink-0 border-b border-border/70" />
      <SidebarNavList />
      <div className="mx-3 h-px bg-border/55" />
      <div
        ref={containerRef}
        role="tree"
        aria-label="Files"
        aria-activedescendant={activeDescendantId}
        tabIndex={0}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        className="flex-1 overflow-y-auto px-2 pb-2 pt-3 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <FileTree />
      </div>
      <SidebarStatusRail />
    </nav>
  );
}
