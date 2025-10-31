/**
 * Main Layout Component - Clean composition using layout components
 */

import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { NoteList } from './NoteList';
import { NoteEditor } from './NoteEditor';
import { SearchPanel } from './SearchPanel';
import { SettingsModal } from '../Settings/SettingsModal';
import { LayoutContainer } from './LayoutContainer';
import { SidebarPanel } from './SidebarPanel';
import { NoteListPanel } from './NoteListPanel';
import { MainContentArea } from './MainContentArea';
import { useUIStore } from '../../stores/uiStore';
import { useNotebookAPI } from '../../hooks/useNotebookAPI';
import { useTagAPI } from '../../hooks/useTagAPI';
import { useNoteAPI } from '../../hooks/useNoteAPI';

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

  const { loadNotebooks } = useNotebookAPI();
  const { loadTags } = useTagAPI();
  const { loadNotes } = useNoteAPI();

  // Load initial data
  useEffect(() => {
    loadNotebooks();
    loadTags();
    loadNotes();
  }, [loadNotebooks, loadTags, loadNotes]);

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
