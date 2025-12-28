/**
 * Main Layout Component - Clean composition using layout components
 */

import { useEffect, useRef, useState } from 'react';
import { Sidebar } from '@renderer/components/features/navigation';
import { NoteEditor, NoteEditorHandle } from '@renderer/components/features/Editor';
import { SearchPanel } from '@renderer/components/features/search';
import { HomePage } from '@renderer/components/features/HomePage';
import { LayoutContainer, SidebarPanel, MainContentArea } from '@renderer/components/composites';
import { SettingsModal } from '@renderer/components/features/Settings';
import { DraftRecoveryDialog } from '@renderer/components/features/Recovery';
import { useUIStore } from '@renderer/stores/uiStore';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useTagAPI } from '@renderer/hooks/useTagAPI';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';
import { useWorkspaceAPI } from '@renderer/hooks/useWorkspaceAPI';
import { useJournalActions } from '@renderer/hooks/useJournalActions';
import { useAppShortcuts } from '@renderer/hooks/useAppShortcuts';
import { getAllDrafts } from '@renderer/utils/draftStorage';
import { logger } from '@renderer/utils/logger';

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

  const { activeNoteId, setActiveNote } = useNoteStore();

  const { loadFileTree } = useFileTreeAPI();
  const { loadTags } = useTagAPI();
  const { loadNotes, createNote } = useNoteAPI();
  const { loadWorkspaces } = useWorkspaceAPI();
  const { openOrCreateTodayJournal } = useJournalActions();

  // Helper to create a note in a specific folder
  const createNoteInFolder = async (folderPath: string) => {
    const now = new Date();
    const defaultTitle = `Untitled Note ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

    const note = await createNote({
      title: defaultTitle,
      content: '',
      folderPath,
    });

    if (note) {
      logger.info(`[MainLayout] Created note in ${folderPath}:`, note.id);
      setActiveNote(note.id);
    }
  };

  // Ref to access editor actions
  const editorRef = useRef<NoteEditorHandle>(null);

  // Draft recovery state
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const recoveryEditorRef = useRef<any>(null);

  // Track if bootstrap is complete and if we've attempted to open the initial journal
  const [bootstrapComplete, setBootstrapComplete] = useState(false);
  const [initialJournalAttempted, setInitialJournalAttempted] = useState(false);
  const initialJournalOpenedRef = useRef(false);

  // Load initial data and check for drafts
  useEffect(() => {
    const bootstrap = async () => {
      await loadWorkspaces();
      await loadFileTree();
      loadTags();
      await loadNotes();

      // Check for unsaved drafts after notes are loaded
      const drafts = getAllDrafts();
      if (drafts.length > 0) {
        logger.info('[MainLayout] Found unsaved drafts on startup:', drafts.length);
        setShowRecoveryDialog(true);
      }

      // Mark bootstrap as complete
      setBootstrapComplete(true);
    };

    void bootstrap();
  }, [loadWorkspaces, loadFileTree, loadTags, loadNotes]);

  // Auto-open today's journal on startup (after bootstrap completes)
  useEffect(() => {
    if (bootstrapComplete && !initialJournalOpenedRef.current) {
      if (showRecoveryDialog) {
        // If recovery dialog is shown, mark as attempted so HomePage can render behind the dialog
        setInitialJournalAttempted(true);
      } else {
        initialJournalOpenedRef.current = true;
        // Open journal immediately - no delay needed
        logger.info('[MainLayout] Auto-opening today\'s journal');
        openOrCreateTodayJournal().finally(() => {
          setInitialJournalAttempted(true);
        });
      }
    }
  }, [bootstrapComplete, showRecoveryDialog, openOrCreateTodayJournal]);

  // Attach keyboard shortcuts using the store
  useAppShortcuts({
    onSave: () => editorRef.current?.save(),
    onNewNote: () => editorRef.current?.createSiblingNote(),
    onNewPersonalNote: () => createNoteInFolder('Personal'),
    onNewWorkNote: () => createNoteInFolder('Work'),
    onTodayJournal: () => openOrCreateTodayJournal(),
  });

  // Handle draft recovery
  const handleRecoverDraft = (noteId: string, content: string) => {
    try {
      // Open the note in the editor
      setActiveNote(noteId);

      // Wait for editor to mount and load content, then restore draft
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.restoreDraft(content);
          logger.info('[MainLayout] Recovered draft for note:', noteId);
        }
      }, 1000); // Wait longer to ensure editor is fully initialized
    } catch (error) {
      logger.error('[MainLayout] Failed to recover draft:', error);
    }
  };

  return (
    <>
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
            {activeNoteId ? (
              <NoteEditor ref={editorRef} />
            ) : (
              // Only show HomePage after initial bootstrap and journal open attempt
              initialJournalAttempted && <HomePage />
            )}
          </MainContentArea>
        }
        overlayContent={<SettingsModal />}
      />

      {/* Draft Recovery Dialog */}
      <DraftRecoveryDialog
        open={showRecoveryDialog}
        onOpenChange={setShowRecoveryDialog}
        onRecover={handleRecoverDraft}
      />
    </>
  );
}
