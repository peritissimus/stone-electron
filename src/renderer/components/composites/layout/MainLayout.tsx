/**
 * Main Layout Component - Clean composition using layout components
 */

import { useEffect, useRef, useState, lazy, Suspense, useMemo } from 'react';
import type { Editor } from '@tiptap/react';
import { Sidebar } from '@renderer/components/features/navigation';
import type { NoteEditorHandle } from '@renderer/components/features/Editor/NoteEditor';
import { LayoutContainer, SidebarPanel, MainContentArea } from '@renderer/components/composites';

// Lazy load heavy components - NoteEditor pulls in entire TipTap stack
const NoteEditor = lazy(() => import('@renderer/components/features/Editor/NoteEditor').then(m => ({ default: m.NoteEditor })));
const HomePage = lazy(() => import('@renderer/components/features/HomePage/HomePage').then(m => ({ default: m.HomePage })));
import { useUIStore } from '@renderer/stores/uiStore';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useTagAPI } from '@renderer/hooks/useTagAPI';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';
import { useWorkspaceAPI } from '@renderer/hooks/useWorkspaceAPI';
import { useJournalActions } from '@renderer/hooks/useJournalActions';
import { useAppShortcuts } from '@renderer/hooks/useAppShortcuts';
import { useDocumentAutosave } from '@renderer/hooks/useDocumentBuffer';
import { getAllDrafts } from '@renderer/utils/draftStorage';
import { logger } from '@renderer/utils/logger';

// Lazy load components not needed on initial render
const SearchPanel = lazy(() => import('@renderer/components/features/search/SearchPanel').then(m => ({ default: m.SearchPanel })));
const SettingsModal = lazy(() => import('@renderer/components/features/Settings/SettingsModal').then(m => ({ default: m.SettingsModal })));
const CommandCenter = lazy(() => import('@renderer/components/features/CommandCenter/CommandCenter').then(m => ({ default: m.CommandCenter })));
const FileSwitcher = lazy(() => import('@renderer/components/features/FileSwitcher/FileSwitcher').then(m => ({ default: m.FileSwitcher })));
const DraftRecoveryDialog = lazy(() => import('@renderer/components/features/Recovery/DraftRecoveryDialog').then(m => ({ default: m.DraftRecoveryDialog })));
const FindReplaceModal = lazy(() => import('@renderer/components/features/FindReplace/FindReplaceModal').then(m => ({ default: m.FindReplaceModal })));

// Minimal loading skeletons for fast LCP
const EditorSkeleton = () => (
  <div className="flex flex-col h-full animate-pulse">
    <div className="h-12 border-b border-border flex items-center px-4">
      <div className="h-6 w-48 bg-muted rounded" />
    </div>
    <div className="flex-1 p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-4 w-3/4 bg-muted rounded" />
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-5/6 bg-muted rounded" />
      </div>
    </div>
  </div>
);

const HomeSkeleton = () => (
  <div className="flex items-center justify-center h-full animate-pulse">
    <div className="text-center space-y-4">
      <div className="h-8 w-32 bg-muted rounded mx-auto" />
      <div className="h-4 w-48 bg-muted rounded mx-auto" />
    </div>
  </div>
);

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

  // Enable document autosave (saves dirty buffers on blur, timer, and before close)
  useDocumentAutosave(30000); // Autosave every 30 seconds

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

  // Track editor instance for FindReplaceModal
  const [currentEditor, setCurrentEditor] = useState<Editor | null>(null);

  // Update editor reference when it changes
  useEffect(() => {
    const checkEditor = () => {
      const editor = editorRef.current?.getEditor() ?? null;
      if (editor !== currentEditor) {
        setCurrentEditor(editor);
      }
    };

    // Check initially and on activeNoteId change
    checkEditor();

    // Also check periodically in case editor initializes asynchronously
    const interval = setInterval(checkEditor, 500);
    return () => clearInterval(interval);
  }, [activeNoteId, currentEditor]);

  // Track if bootstrap is complete and if we've attempted to open the initial journal
  const [bootstrapComplete, setBootstrapComplete] = useState(false);
  const [initialJournalAttempted, setInitialJournalAttempted] = useState(false);
  const initialJournalOpenedRef = useRef(false);

  // Load initial data and check for drafts
  useEffect(() => {
    const bootstrap = async () => {
      const startTime = performance.now();

      // Load workspace first (required for other operations)
      await loadWorkspaces();
      logger.info(`[MainLayout] Workspaces loaded: ${(performance.now() - startTime).toFixed(0)}ms`);

      // Then load everything else in PARALLEL
      const [, , notesResult] = await Promise.all([
        loadFileTree().then(() => {
          logger.info(`[MainLayout] FileTree loaded: ${(performance.now() - startTime).toFixed(0)}ms`);
        }),
        loadTags().then(() => {
          logger.info(`[MainLayout] Tags loaded: ${(performance.now() - startTime).toFixed(0)}ms`);
        }),
        loadNotes().then(() => {
          logger.info(`[MainLayout] Notes loaded: ${(performance.now() - startTime).toFixed(0)}ms`);
        }),
      ]);

      // Check for unsaved drafts after notes are loaded
      const drafts = getAllDrafts();
      if (drafts.length > 0) {
        logger.info('[MainLayout] Found unsaved drafts on startup:', drafts.length);
        setShowRecoveryDialog(true);
      }

      logger.info(`[MainLayout] Bootstrap complete: ${(performance.now() - startTime).toFixed(0)}ms`);
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
            {searchOpen && (
              <Suspense fallback={<div className="p-4 text-muted-foreground">Loading search...</div>}>
                <SearchPanel />
              </Suspense>
            )}
            {activeNoteId ? (
              <Suspense fallback={<EditorSkeleton />}>
                <NoteEditor ref={editorRef} />
              </Suspense>
            ) : (
              // Only show HomePage after initial bootstrap and journal open attempt
              initialJournalAttempted && (
                <Suspense fallback={<HomeSkeleton />}>
                  <HomePage />
                </Suspense>
              )
            )}
          </MainContentArea>
        }
        overlayContent={
          <>
            <Suspense fallback={null}>
              <SettingsModal />
            </Suspense>
            <Suspense fallback={null}>
              <CommandCenter />
            </Suspense>
            <Suspense fallback={null}>
              <FileSwitcher />
            </Suspense>
            <Suspense fallback={null}>
              <FindReplaceModal editor={currentEditor} />
            </Suspense>
          </>
        }
      />

      {/* Draft Recovery Dialog - lazy loaded */}
      <Suspense fallback={null}>
        <DraftRecoveryDialog
          open={showRecoveryDialog}
          onOpenChange={setShowRecoveryDialog}
          onRecover={handleRecoverDraft}
        />
      </Suspense>
    </>
  );
}
