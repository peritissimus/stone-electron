/**
 * LayoutContainer Component - Main layout structure with resizable panels
 */

import { ResizablePanel } from './ResizablePanel';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heading3 } from '@renderer/components/base/ui/text';
import { Gear } from '@phosphor-icons/react';
import { Header, IconButton, ControlGroup } from '@renderer/components/composites';
import { formatShortcut } from '@renderer/hooks/useKeyboardShortcuts';
import { toSettings } from '@renderer/navigation/routes';

export interface LayoutContainerProps {
  sidebar?: React.ReactNode;
  sidebarWidth: number;
  onSidebarWidthChange: (width: number) => void;
  showSidebar: boolean;

  mainContent: React.ReactNode;

  overlayContent?: React.ReactNode;

  className?: string;
}

export function LayoutContainer({
  sidebar,
  sidebarWidth,
  onSidebarWidthChange,
  showSidebar,

  mainContent,
  overlayContent,

  className = '',
}: LayoutContainerProps) {
  const navigate = useNavigate();

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
              icon={<Gear size={12} />}
              label="Settings"
              tooltip={`Settings (${formatShortcut(',', true)})`}
              onClick={() => navigate(toSettings())}
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
            className="bg-sidebar border-r border-border transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"
          >
            {sidebar}
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
