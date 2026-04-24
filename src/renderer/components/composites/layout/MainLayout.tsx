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
import { useSidebarCursor } from '@renderer/hooks/useSidebarCursor';
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
const ScratchEditor = lazy(() =>
  import('@renderer/components/features/Editor/ScratchEditor').then((m) => ({
    default: m.ScratchEditor,
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
import { useScratchAPI } from '@renderer/hooks/useScratchAPI';
import { subscribe } from '@renderer/lib/events';
import { EVENTS } from '@shared/constants/ipcChannels';
import { useDocumentAutosave } from '@renderer/hooks/useDocumentBuffer';
import { getAllDrafts } from '@renderer/lib/draftStorage';
import { logger } from '@renderer/lib/logger';
import { useLocation, useNavigate } from 'react-router-dom';

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
function NoteRoute({
  editorRef,
  onEditorChange,
}: {
  editorRef: React.RefObject<NoteEditorHandle>;
  onEditorChange: (editor: Editor | null) => void;
}) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <NoteEditor ref={editorRef} onEditorChange={onEditorChange} />
    </Suspense>
  );
}

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigateToNote = useNavigateToNote();
  const initialPathRef = useRef(location.pathname);
  const { pickScratchFile } = useScratchAPI();
  const { sidebarOpen, sidebarWidth, editorFullscreen, setSidebarWidth, toggleSidebar } = useUI();

  // Derive tree state from the route and subscribe to sidebar-relevant events.
  // These used to live inside <Sidebar>; kept here so <Sidebar> is pure
  // composition and these subscriptions keep running even if the sidebar is
  // collapsed (the file tree state still has to stay coherent).
  useAutoExpandAncestors();
  const { selectedFile, activeFolder } = useTreeSelection();
  useSidebarEvents({ activeFolder });

  // Open any .md file on disk in the scratch editor. Shortcut: ⌘O.
  // Opens the system file picker via main-process IPC, then navigates to
  // /scratch?path=<abs>. No workspace or DB involvement — scratch is
  // ephemeral and lives entirely at the absolute path.
  const handleOpenFile = useCallback(async () => {
    const pickedPath = await pickScratchFile();
    if (!pickedPath) return;
    navigate(`/scratch?path=${encodeURIComponent(pickedPath)}`);
  }, [navigate, pickScratchFile]);

  // "Open With Stone" from Finder / Windows Explorer — main process pushes
  // the absolute path via SCRATCH_OPEN_PATH after resolving open-file
  // (macOS), second-instance argv, or cold-start argv. Navigate straight to
  // the scratch editor; the same seam the ⌘O shortcut uses.
  useEffect(() => {
    const unsubscribe = subscribe(EVENTS.SCRATCH_OPEN_PATH, (payload: unknown) => {
      if (typeof payload !== 'string' || !payload) return;
      navigate(`/scratch?path=${encodeURIComponent(payload)}`);
    });
    return unsubscribe;
  }, [navigate]);

  const { requestFocus: requestSidebarFocus, getCursorPath } = useSidebarCursor();
  const handleFocusSidebar = useCallback(() => {
    if (!sidebarOpen) toggleSidebar();
    // The cursor is sticky across ⌘E presses: if the user has navigated the
    // tree (or opened a note from elsewhere and hasn't explicitly reset), we
    // keep them where they are. Only seed from the active note when the
    // cursor is null — the true "first entry" case, or after an explicit
    // clear. This matches the user's muscle memory: ⌘E drops you back into
    // the tree at your last position, not the current route's position.
    const existing = getCursorPath();
    requestSidebarFocus(existing ?? selectedFile ?? activeFolder ?? null);
  }, [sidebarOpen, toggleSidebar, requestSidebarFocus, getCursorPath, selectedFile, activeFolder]);

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
  const handleEditorChange = useCallback((editor: Editor | null) => {
    setCurrentEditor(editor);
  }, []);

  // Track bootstrap state
  const [bootstrapComplete, setBootstrapComplete] = useState(false);
  const initialJournalOpenedRef = useRef(false);

  // Load initial data
  useEffect(() => {
    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const scheduleBackgroundNotesLoad = () => {
      const loadNotesInBackground = async () => {
        try {
          await loadNotes();
          if (!cancelled) {
            logger.info('[MainLayout] Notes loaded in background');
          }
        } catch (error) {
          if (!cancelled) {
            logger.error('[MainLayout] Background notes load failed:', error);
          }
        }
      };

      if (typeof window.requestIdleCallback === 'function') {
        idleHandle = window.requestIdleCallback(() => {
          idleHandle = null;
          void loadNotesInBackground();
        });
        return;
      }

      timeoutHandle = setTimeout(() => {
        timeoutHandle = null;
        void loadNotesInBackground();
      }, 0);
    };

    const bootstrap = async () => {
      const startTime = performance.now();
      const shouldPrioritizeNotes = initialPathRef.current.startsWith('/note/');

      await loadWorkspaces();
      if (cancelled) return;
      logger.info(`[MainLayout] Workspaces loaded: ${(performance.now() - startTime).toFixed(0)}ms`);

      await Promise.all([
        loadFileTree().then(() => {
          if (!cancelled) {
            logger.info(`[MainLayout] FileTree loaded: ${(performance.now() - startTime).toFixed(0)}ms`);
          }
        }),
        loadTags().then(() => {
          if (!cancelled) {
            logger.info(`[MainLayout] Tags loaded: ${(performance.now() - startTime).toFixed(0)}ms`);
          }
        }),
        ...(shouldPrioritizeNotes
          ? [
              loadNotes().then(() => {
                if (!cancelled) {
                  logger.info(
                    `[MainLayout] Notes loaded: ${(performance.now() - startTime).toFixed(0)}ms`,
                  );
                }
              }),
            ]
          : []),
      ]);
      if (cancelled) return;

      const drafts = getAllDrafts();
      if (drafts.length > 0) {
        logger.info('[MainLayout] Found unsaved drafts on startup:', drafts.length);
        setShowRecoveryDialog(true);
      }

      logger.info(`[MainLayout] Bootstrap complete: ${(performance.now() - startTime).toFixed(0)}ms`);
      setBootstrapComplete(true);

      if (!shouldPrioritizeNotes) {
        scheduleBackgroundNotesLoad();
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      if (idleHandle !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
    };
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
    onOpenFile: () => void handleOpenFile(),
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
              <Route
                path="/note/:noteId"
                element={<NoteRoute editorRef={editorRef} onEditorChange={handleEditorChange} />}
              />
              <Route
                path="/scratch"
                element={
                  <Suspense fallback={<EditorSkeleton />}>
                    <ScratchEditor />
                  </Suspense>
                }
              />
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
