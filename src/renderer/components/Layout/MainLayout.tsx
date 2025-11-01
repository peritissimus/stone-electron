/**
 * Main Layout Component - Clean composition using layout components
 */

import { useEffect } from 'react';
import { Sidebar, NoteList, NoteEditor, SearchPanel, LayoutContainer, SidebarPanel, NoteListPanel, MainContentArea } from '@renderer/components/Layout';
import { SettingsModal } from '@renderer/components/Settings';
import { useUIStore } from '@renderer/stores/uiStore';
import { useTagAPI } from '@renderer/hooks/useTagAPI';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';

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

  // Load initial data
  useEffect(() => {
    loadFileTree();
    loadTags();
    loadNotes();
  }, [loadFileTree, loadTags, loadNotes]);

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
      noteList={
        <NoteListPanel>
          <NoteList />
        </NoteListPanel>
      }
      noteListWidth={noteListWidth}
      onNoteListWidthChange={setNoteListWidth}
      showNoteList={!editorFullscreen}
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
