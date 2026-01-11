/**
 * Main Layout Component - Clean composition using layout components
 */

import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import type { Editor } from '@tiptap/react';
import { Sidebar } from '@renderer/components/features/navigation';
import type { NoteEditorHandle } from '@renderer/components/features/Editor/NoteEditor';
import { LayoutContainer, SidebarPanel, MainContentArea } from '@renderer/components/composites';

// Lazy load heavy components
const NoteEditor = lazy(() =>
  import('@renderer/components/features/Editor/NoteEditor').then((m) => ({
    default: m.NoteEditor,
  })),
);
const HomePage = lazy(() =>
  import('@renderer/components/features/HomePage/HomePage').then((m) => ({ default: m.HomePage })),
);
const TasksPage = lazy(() =>
  import('@renderer/components/features/Tasks/TasksPage').then((m) => ({ default: m.TasksPage })),
);
const GraphPage = lazy(() =>
  import('@renderer/components/features/Graph/GraphPage').then((m) => ({ default: m.GraphPage })),
);
const TopicsPage = lazy(() =>
  import('@renderer/components/features/Topics/TopicsPage').then((m) => ({
    default: m.TopicsPage,
  })),
);

import { useUI } from '@renderer/hooks/useUI';
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

// Lazy load overlay components
const SettingsModal = lazy(() =>
  import('@renderer/components/features/Settings/SettingsModal').then((m) => ({
    default: m.SettingsModal,
  })),
);
const CommandCenter = lazy(() =>
  import('@renderer/components/features/CommandCenter/CommandCenter').then((m) => ({
    default: m.CommandCenter,
  })),
);
const DraftRecoveryDialog = lazy(() =>
  import('@renderer/components/features/Recovery/DraftRecoveryDialog').then((m) => ({
    default: m.DraftRecoveryDialog,
  })),
);
const FindReplaceModal = lazy(() =>
  import('@renderer/components/features/FindReplace/FindReplaceModal').then((m) => ({
    default: m.FindReplaceModal,
  })),
);

// Loading skeletons
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

const PageSkeleton = () => (
  <div className="flex items-center justify-center h-full animate-pulse">
    <div className="text-center space-y-4">
      <div className="h-8 w-32 bg-muted rounded mx-auto" />
      <div className="h-4 w-48 bg-muted rounded mx-auto" />
    </div>
  </div>
);

// Note route wrapper - syncs URL param with note store
function NoteRoute({ editorRef }: { editorRef: React.RefObject<NoteEditorHandle> }) {
  const { noteId } = useParams<{ noteId: string }>();
  const { setActiveNote } = useNoteStore();

  // Sync URL noteId to store
  useEffect(() => {
    if (noteId) {
      setActiveNote(noteId);
    }
  }, [noteId, setActiveNote]);

  return (
    <Suspense fallback={<EditorSkeleton />}>
      <NoteEditor ref={editorRef} />
    </Suspense>
  );
}

export function MainLayout() {
  const navigate = useNavigate();
  const { sidebarOpen, sidebarWidth, noteListWidth, editorFullscreen, setSidebarWidth, setNoteListWidth } =
    useUI();

  const { setActiveNote } = useNoteStore();

  const { loadFileTree } = useFileTreeAPI();
  const { loadTags } = useTagAPI();
  const { loadNotes, createNote } = useNoteAPI();
  const { loadWorkspaces } = useWorkspaceAPI();
  const { openOrCreateTodayJournal } = useJournalActions();

  // Enable document autosave
  useDocumentAutosave(30000);

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
      navigate(`/note/${note.id}`);
    }
  };

  // Ref to access editor actions
  const editorRef = useRef<NoteEditorHandle>(null);

  // Draft recovery state
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);

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

    checkEditor();
    const interval = setInterval(checkEditor, 500);
    return () => clearInterval(interval);
  }, [currentEditor]);

  // Track bootstrap state
  const [bootstrapComplete, setBootstrapComplete] = useState(false);
  const initialJournalOpenedRef = useRef(false);

  // Load initial data
  useEffect(() => {
    const bootstrap = async () => {
      const startTime = performance.now();

      await loadWorkspaces();
      logger.info(`[MainLayout] Workspaces loaded: ${(performance.now() - startTime).toFixed(0)}ms`);

      await Promise.all([
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

      const drafts = getAllDrafts();
      if (drafts.length > 0) {
        logger.info('[MainLayout] Found unsaved drafts on startup:', drafts.length);
        setShowRecoveryDialog(true);
      }

      logger.info(`[MainLayout] Bootstrap complete: ${(performance.now() - startTime).toFixed(0)}ms`);
      setBootstrapComplete(true);
    };

    void bootstrap();
  }, [loadWorkspaces, loadFileTree, loadTags, loadNotes]);

  // Auto-open today's journal on startup
  useEffect(() => {
    if (bootstrapComplete && !initialJournalOpenedRef.current && !showRecoveryDialog) {
      initialJournalOpenedRef.current = true;
      logger.info("[MainLayout] Auto-opening today's journal");
      openOrCreateTodayJournal();
    }
  }, [bootstrapComplete, showRecoveryDialog, openOrCreateTodayJournal]);

  // Keyboard shortcuts
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
      navigate(`/note/${noteId}`);
      setActiveNote(noteId);

      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.restoreDraft(content);
          logger.info('[MainLayout] Recovered draft for note:', noteId);
        }
      }, 1000);
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
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route
                path="/home"
                element={
                  bootstrapComplete ? (
                    <Suspense fallback={<PageSkeleton />}>
                      <HomePage />
                    </Suspense>
                  ) : (
                    <PageSkeleton />
                  )
                }
              />
              <Route
                path="/tasks"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <TasksPage />
                  </Suspense>
                }
              />
              <Route
                path="/graph"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <GraphPage />
                  </Suspense>
                }
              />
              <Route
                path="/topics"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <TopicsPage />
                  </Suspense>
                }
              />
              <Route path="/note/:noteId" element={<NoteRoute editorRef={editorRef} />} />
              {/* Catch-all redirect to home */}
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
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
              <FindReplaceModal editor={currentEditor} />
            </Suspense>
          </>
        }
      />

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
