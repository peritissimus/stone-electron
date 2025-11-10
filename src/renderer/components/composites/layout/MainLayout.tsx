/**
 * Main Layout Component - Clean composition using layout components
 */

import { useEffect, useRef, useMemo } from 'react';
import { Sidebar } from '@renderer/components/features/navigation';
import { NoteEditor, NoteEditorHandle } from '@renderer/components/features/Editor';
import { SearchPanel } from '@renderer/components/features/search';
import { HomePage } from '@renderer/components/features/HomePage';
import { LayoutContainer, SidebarPanel, MainContentArea } from '@renderer/components/composites';
import { SettingsModal } from '@renderer/components/features/Settings';
import { useUIStore } from '@renderer/stores/uiStore';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useTagAPI } from '@renderer/hooks/useTagAPI';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';
import { useWorkspaceAPI } from '@renderer/hooks/useWorkspaceAPI';
import {
  useKeyboardShortcuts,
  ShortcutConfig,
  isMacOS,
} from '@renderer/hooks/useKeyboardShortcuts';

export function MainLayout() {
  const {
    sidebarOpen,
    sidebarWidth,
    noteListWidth,
    editorFullscreen,
    searchOpen,
    setSidebarWidth,
    setNoteListWidth,
    openSettings,
  } = useUIStore();

  const { activeNoteId } = useNoteStore();

  const { loadFileTree } = useFileTreeAPI();
  const { loadTags } = useTagAPI();
  const { loadNotes } = useNoteAPI();
  const { loadWorkspaces } = useWorkspaceAPI();

  // Ref to access editor actions
  const editorRef = useRef<NoteEditorHandle>(null);

  // Load initial data
  useEffect(() => {
    const bootstrap = async () => {
      await loadWorkspaces();
      await loadFileTree();
      loadTags();
      loadNotes();
    };

    void bootstrap();
  }, [loadWorkspaces, loadFileTree, loadTags, loadNotes]);

  // Keyboard shortcuts configuration
  const shortcuts = useMemo<ShortcutConfig[]>(
    () => [
      {
        key: 's',
        metaKey: isMacOS(),
        ctrlKey: !isMacOS(),
        action: () => {
          editorRef.current?.save();
        },
        description: 'Save current note',
      },
      {
        key: 'n',
        metaKey: isMacOS(),
        ctrlKey: !isMacOS(),
        action: () => {
          editorRef.current?.createSiblingNote();
        },
        description: 'Create new note in current folder',
      },
      {
        key: ',',
        metaKey: isMacOS(),
        ctrlKey: !isMacOS(),
        action: () => {
          openSettings();
        },
        description: 'Open settings',
      },
    ],
    [],
  );

  // Attach keyboard shortcuts
  useKeyboardShortcuts(shortcuts);

  return (
    <LayoutContainer
      sidebar={
        <SidebarPanel>
          <Sidebar />
        </SidebarPanel>
      }
      sidebarWidth={sidebarWidth}
      onSidebarWidthChange={setSidebarWidth}
      showSidebar={sidebarOpen && !editorFullscreen}
      noteList={null}
      noteListWidth={noteListWidth}
      onNoteListWidthChange={setNoteListWidth}
      showNoteList={false}
      mainContent={
        <MainContentArea>
          {searchOpen && <SearchPanel />}
          {activeNoteId ? <NoteEditor ref={editorRef} /> : <HomePage />}
        </MainContentArea>
      }
      overlayContent={<SettingsModal />}
    />
  );
}
