/**
 * Main Layout Component - Clean composition using layout components
 */

import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import type { RichTextEditor } from '@renderer/editor';
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
import { MainLayoutRoutes, PageSkeleton } from './MainLayoutRoutes';
import { MainLayoutOverlays } from './MainLayoutOverlays';

const OnboardingScreen = lazy(() =>
  import('@renderer/components/features/Onboarding').then((m) => ({
    default: m.OnboardingScreen,
  })),
);
const DraftRecoveryDialog = lazy(() =>
  import('@renderer/components/features/Recovery/DraftRecoveryDialog').then((m) => ({
    default: m.DraftRecoveryDialog,
  })),
);

import { useUI } from '@renderer/hooks/useUI';
import { useWorkspaces } from '@renderer/hooks/useWorkspaces';
import { useTagAPI } from '@renderer/hooks/useTagAPI';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';
import { useWorkspaceSync } from '@renderer/hooks/useWorkspaceSync';
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

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigateToNote = useNavigateToNote();
  const initialPathRef = useRef(location.pathname);
  const { pickScratchFile } = useScratchAPI();
  const { sidebarOpen, sidebarWidth, editorFullscreen, setSidebarWidth, toggleSidebar } = useUI();
  const { workspaces } = useWorkspaces();

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
  const syncWorkspace = useWorkspaceSync();

  // syncWorkspace's identity tracks the active folder, but the bootstrap
  // effect below must run exactly once — read the latest through a ref
  // instead of adding it to the effect deps.
  const syncWorkspaceRef = useRef(syncWorkspace);
  useEffect(() => {
    syncWorkspaceRef.current = syncWorkspace;
  });

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
  const [currentEditor, setCurrentEditor] = useState<RichTextEditor | null>(null);
  const handleEditorChange = useCallback((editor: RichTextEditor | null) => {
    setCurrentEditor(editor);
  }, []);

  // Track bootstrap state
  const [bootstrapComplete, setBootstrapComplete] = useState(false);

  // Set once onboarding completes, so the gate (incl. the dev force override)
  // releases and the app shell takes over.
  const [onboardingDone, setOnboardingDone] = useState(false);

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

      // Reconcile orphan files (markdown created outside the app, via git
      // pull, QuickCapture races, etc.) on idle so they become searchable
      // without the user having to click the top-bar Sync button.
      const reconcileWhenIdle = () => {
        const trigger = () => {
          if (cancelled) return;
          void syncWorkspaceRef.current({ silent: true });
        };
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(trigger, { timeout: 5000 });
        } else {
          setTimeout(trigger, 1000);
        }
      };
      reconcileWhenIdle();
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
  const handleRecoverDraft = useCallback(
    (noteId: string, content: string) => {
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
    },
    [navigateToNote],
  );

  // First-launch gate: once bootstrap has confirmed there are no workspaces,
  // show onboarding instead of the app shell. The shell would otherwise have
  // no active workspace to render against (empty tree, journals with nowhere
  // to write). Creating + activating a workspace flips this off.
  //
  // Dev-only override: VITE_FORCE_ONBOARDING=true forces the screen even when
  // workspaces exist, so the onboarding UI can be iterated with a normal
  // `pnpm dev`. Completing onboarding once clears the override (onboardingDone)
  // so you're not stuck on it.
  const devForceOnboarding =
    import.meta.env.DEV && import.meta.env.VITE_FORCE_ONBOARDING === 'true';
  const showOnboarding =
    !onboardingDone && ((bootstrapComplete && workspaces.length === 0) || devForceOnboarding);
  if (showOnboarding) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <OnboardingScreen onComplete={() => setOnboardingDone(true)} />
      </Suspense>
    );
  }

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
            <MainLayoutRoutes editorRef={editorRef} onEditorChange={handleEditorChange} />
          </MainContentArea>
        }
        overlayContent={<MainLayoutOverlays editor={currentEditor} />}
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
