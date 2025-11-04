/**
 * LayoutContainer Component - Main layout structure with resizable panels
 */

import { ResizablePanel } from '@renderer/components/features/Layout/ResizablePanel';
import React from 'react';
import { useUIStore } from '@renderer/stores/uiStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { Heading3 } from '@renderer/components/base/ui/text';
import { logger } from '@renderer/utils/logger';
import { Gear, ArrowsClockwise } from 'phosphor-react';
import { Header, IconButton, ControlGroup } from '@renderer/components/composites';
import { useWorkspaceAPI } from '@renderer/hooks/useWorkspaceAPI';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';

export interface LayoutContainerProps {
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
  const { openSettings } = useUIStore();
  const { loadFileTree } = useFileTreeAPI();
  const { syncWorkspace, loadWorkspaces } = useWorkspaceAPI();
  const { loadNotes } = useNoteAPI();
  const { activeFolder } = useFileTreeStore();

  return (
    <>
      <Header
        size="normal"
        className="fixed top-0 left-0 right-0 z-10"
        left={<Heading3 className="ml-[64px] text-xs">Stone</Heading3>}
        right={
          <ControlGroup gap="sm" background="bg-transparent">
            <IconButton
              size="compact"
              icon={<ArrowsClockwise size={12} />}
              label="Sync"
              tooltip="Sync with file system"
              onClick={async () => {
                try {
                  const res = await syncWorkspace();
                  if (res.success) {
                    logger.info('Sync complete', res.data);
                    await loadWorkspaces();
                    await loadFileTree();
                    if (activeFolder) {
                      await loadNotes({ folderPath: activeFolder });
                    } else {
                      await loadNotes();
                    }
                  } else {
                    logger.error('Sync failed', res.error);
                    alert(res.error?.message || 'Sync failed');
                  }
                } catch (e) {
                  logger.error('Sync error', e);
                  alert('Sync failed');
                }
              }}
            />
            <IconButton
              size="compact"
              icon={<Gear size={12} />}
              label="Settings"
              onClick={openSettings}
            />
          </ControlGroup>
        }
      />

      <div className={`flex h-screen pt-8 bg-background overflow-hidden ${className}`}>
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
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">{mainContent}</div>

        {/* Overlay Content (modals, etc.) */}
        {overlayContent}
      </div>
    </>
  );
}
