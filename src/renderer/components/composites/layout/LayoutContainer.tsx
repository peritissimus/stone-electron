/**
 * LayoutContainer Component - Main layout structure with resizable panels
 */

import { ResizablePanel } from './ResizablePanel';
import React from 'react';
import { TitlebarNavigationControls } from './TitlebarNavigationControls';

export interface LayoutContainerProps {
  sidebar?: React.ReactNode;
  sidebarWidth: number;
  onSidebarWidthChange: (width: number) => void;
  showSidebar: boolean;
  onToggleSidebar: () => void;

  mainContent: React.ReactNode;

  overlayContent?: React.ReactNode;

  className?: string;
}

export function LayoutContainer({
  sidebar,
  sidebarWidth,
  onSidebarWidthChange,
  showSidebar,
  onToggleSidebar,

  mainContent,
  overlayContent,

  className = '',
}: LayoutContainerProps) {
  return (
    <>
      <div className={`relative flex h-screen bg-background overflow-hidden ${className}`}>
        <TitlebarNavigationControls
          sidebarOpen={showSidebar}
          toggleSidebar={onToggleSidebar}
          className="absolute left-0 top-0 z-20"
        />
        {/* Sidebar Panel */}
        {showSidebar && sidebar && (
          <ResizablePanel
            width={sidebarWidth}
            onWidthChange={onSidebarWidthChange}
            minWidth={200}
            maxWidth={400}
            className="bg-sidebar border-r border-border transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"
          >
            {sidebar}
          </ResizablePanel>
        )}

        {/* Main Content Area */}
        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden ${showSidebar ? '' : 'persistent-titlebar-collapsed'}`}
        >
          {mainContent}
        </div>

        {/* Overlay Content (modals, etc.) */}
        {overlayContent}
      </div>
    </>
  );
}
