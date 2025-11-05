/**
 * Main Layout Component - Clean composition using layout components
 */

import { useEffect } from 'react';
import { Sidebar } from '@renderer/components/features/navigation';
import { NoteEditor } from '@renderer/components/features/editor';
import { SearchPanel } from '@renderer/components/features/search';
import { LayoutContainer, SidebarPanel, MainContentArea } from '@renderer/components/composites';
import { SettingsModal } from '@renderer/components/features/settings';
import { useUIStore } from '@renderer/stores/uiStore';
import { useTagAPI } from '@renderer/hooks/useTagAPI';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';
import { useWorkspaceAPI } from '@renderer/hooks/useWorkspaceAPI';

export function MainLayout() {
  const {
    sidebarOpen,
    sidebarWidth,
    noteListWidth,
    editorFullscreen,
    searchOpen,
    setSidebarWidth,
    setNoteListWidth,
  } = useUIStore();

  const { loadFileTree } = useFileTreeAPI();
  const { loadTags } = useTagAPI();
  const { loadNotes } = useNoteAPI();
  const { loadWorkspaces } = useWorkspaceAPI();

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
          <NoteEditor />
        </MainContentArea>
      }
      overlayContent={<SettingsModal />}
    />
  );
}
