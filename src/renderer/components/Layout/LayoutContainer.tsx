/**
 * LayoutContainer Component - Main layout structure with resizable panels
 */

import React from 'react';
import { ResizablePanel } from './ResizablePanel';

interface LayoutContainerProps {
  sidebar?: React.ReactNode;
  sidebarWidth: number;
  onSidebarWidthChange: (width: number) => void;
  showSidebar: boolean;

  noteList?: React.ReactNode;
  noteListWidth: number;
  onNoteListWidthChange: (width: number) => void;
  showNoteList: boolean;

  mainContent: React.ReactNode;

  overlayContent?: React.ReactNode;

  className?: string;
}

export function LayoutContainer({
  sidebar,
  sidebarWidth,
  onSidebarWidthChange,
  showSidebar,

  noteList,
  noteListWidth,
  onNoteListWidthChange,
  showNoteList,

  mainContent,
  overlayContent,

  className = '',
}: LayoutContainerProps) {
  return (
    <div className={`flex h-screen bg-background overflow-hidden ${className}`}>
      {/* Sidebar Panel */}
      {showSidebar && sidebar && (
        <ResizablePanel
          width={sidebarWidth}
          onWidthChange={onSidebarWidthChange}
          minWidth={200}
          maxWidth={400}
          className="bg-sidebar border-r border-border"
        >
          {sidebar}
        </ResizablePanel>
      )}

      {/* Note List Panel */}
      {showNoteList && noteList && (
        <ResizablePanel
          width={noteListWidth}
          onWidthChange={onNoteListWidthChange}
          minWidth={280}
          maxWidth={480}
          className="bg-secondary border-r border-border"
        >
          {noteList}
        </ResizablePanel>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">{mainContent}</div>

      {/* Overlay Content (modals, etc.) */}
      {overlayContent}
    </div>
  );
}
