/**
 * Main Layout Component - Clean composition using layout components
 */

import React, { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import type { Editor } from '@tiptap/react';
import type { NoteEditorHandle } from '@renderer/components/features/Editor/NoteEditor';
import { useAutoExpandAncestors } from '@renderer/hooks/useAutoExpandAncestors';
import { useSidebarEvents } from '@renderer/hooks/useSidebarEvents';
import { useTreeSelection } from '@renderer/hooks/useTreeSelection';
import { useSidebarFocusStore } from '@renderer/stores/sidebarFocusStore';
import { useNavigateToNote } from '@renderer/navigation';
import {
  LayoutContainer,
  SidebarPanel,
  MainContentArea,
  Sidebar,
} from '@renderer/components/composites';

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
import { useTagAPI } from '@renderer/hooks/useTagAPI';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';
import { useWorkspaceAPI } from '@renderer/hooks/useWorkspaceAPI';
import { useJournalActions } from '@renderer/hooks/useJournalActions';
import { useQuickNoteActions } from '@renderer/hooks/useQuickNoteActions';
import { useAppShortcuts } from '@renderer/hooks/useAppShortcuts';
import { useDocumentAutosave } from '@renderer/hooks/useDocumentBuffer';
import { getAllDrafts } from '@renderer/lib/draftStorage';
import { logger } from '@renderer/lib/logger';
import { useLocation } from 'react-router-dom';

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

// Note route wrapper — the route itself owns which note is active (via useParams).
// Children read it with useActiveNoteId(); no store mirror is required.
function NoteRoute({ editorRef }: { editorRef: React.RefObject<NoteEditorHandle> }) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <NoteEditor ref={editorRef} />
    </Suspense>
  );
}

export function MainLayout() {
  const location = useLocation();
  const navigateToNote = useNavigateToNote();
  const { sidebarOpen, sidebarWidth, editorFullscreen, setSidebarWidth, toggleSidebar } = useUI();

  // Derive tree state from the route and subscribe to sidebar-relevant events.
  // These used to live inside <Sidebar>; kept here so <Sidebar> is pure
  // composition and these subscriptions keep running even if the sidebar is
  // collapsed (the file tree state still has to stay coherent).
  useAutoExpandAncestors();
  const { selectedFile, activeFolder } = useTreeSelection();
  useSidebarEvents({ activeFolder });

  const requestSidebarFocus = useSidebarFocusStore((s) => s.requestFocus);
  const handleFocusSidebar = useCallback(() => {
    if (!sidebarOpen) toggleSidebar();
    // Starting cursor: the active note's file (contextual pickup) or the
    // folder containing it if no file path; else null (first j lands on 0).
    requestSidebarFocus(selectedFile ?? activeFolder ?? null);
  }, [sidebarOpen, toggleSidebar, requestSidebarFocus, selectedFile, activeFolder]);

  const { loadFileTree } = useFileTreeAPI();
  const { loadTags } = useTagAPI();
  const { loadNotes } = useNoteAPI();
  const { loadWorkspaces } = useWorkspaceAPI();
  const { openOrCreateTodayJournal } = useJournalActions();
  const { createPersonal, createWork } = useQuickNoteActions();

  // Enable document autosave (saves on blur, beforeunload, and note switch)
  const { saveNote } = useDocumentAutosave();

  // Track previous note to save when switching
  const previousNoteIdRef = useRef<string | null>(null);

  // Save previous note when navigating away
  useEffect(() => {
    // Extract noteId from path like /note/abc123
    const match = location.pathname.match(/^\/note\/(.+)$/);
    const currentNoteId = match ? match[1] : null;

    // If we had a previous note and we're switching to a different one, save it
    if (previousNoteIdRef.current && previousNoteIdRef.current !== currentNoteId) {
      logger.debug('[MainLayout] Note switch detected, saving previous note:', previousNoteIdRef.current);
      saveNote(previousNoteIdRef.current);
    }

    previousNoteIdRef.current = currentNoteId;
  }, [location.pathname, saveNote]);

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
    onNewPersonalNote: () => createPersonal(),
    onNewWorkNote: () => createWork(),
    onTodayJournal: () => openOrCreateTodayJournal(),
    onFocusSidebar: handleFocusSidebar,
  });

  // Handle draft recovery — open the note through the single navigate-to-note
  // seam, then restore content once the editor mounts. The 1s timeout is a
  // render-delay workaround, intentionally separate from route construction.
  const handleRecoverDraft = (noteId: string, content: string) => {
    try {
      navigateToNote(noteId);

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
