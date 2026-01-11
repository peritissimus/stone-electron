/**
 * useNoteEditor Hook - Provides all state and actions for the note editor
 *
 * Abstracts store access per architecture rules:
 * Components → Hooks → Stores
 */

import { useCallback, useMemo } from 'react';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useWorkspaceStore } from '@renderer/stores/workspaceStore';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useDocumentBufferStore } from '@renderer/stores/documentBufferStore';
import { normalizePath } from '@renderer/utils/path';

type NoteStoreState = ReturnType<typeof useNoteStore.getState>;

/**
 * Main hook for note editor state
 */
export function useNoteEditor() {
  // Memoized selector for active note
  const selectActiveNote = useCallback((state: NoteStoreState) => {
    if (!state.activeNoteId) return null;
    return state.notes.find((note) => note.id === state.activeNoteId) || null;
  }, []);

  const activeNote = useNoteStore(selectActiveNote);
  const setActiveNote = useNoteStore((state) => state.setActiveNote);

  // Derived values
  const activeNoteId = activeNote?.id || null;
  const activeNoteFilePath = useMemo(
    () => (activeNote?.filePath ? activeNote.filePath.replace(/\\/g, '/') : ''),
    [activeNote?.filePath],
  );

  return {
    activeNote,
    activeNoteId,
    activeNoteFilePath,
    setActiveNote,
  };
}

/**
 * Hook for active workspace state
 */
export function useActiveWorkspace() {
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId),
    [workspaces, activeWorkspaceId],
  );

  return { activeWorkspace, activeWorkspaceId };
}

/**
 * Hook for file tree actions (used when navigating between notes)
 */
export function useFileTreeActions() {
  const setSelectedFile = useFileTreeStore((state) => state.setSelectedFile);
  const setActiveFolder = useFileTreeStore((state) => state.setActiveFolder);

  const syncFileTreeSelection = useCallback(
    (filePath: string) => {
      if (!filePath) return;
      const normalizedPath = normalizePath(filePath);
      setSelectedFile(normalizedPath);

      const lastSlash = normalizedPath.lastIndexOf('/');
      if (lastSlash > 0) {
        setActiveFolder(normalizedPath.substring(0, lastSlash));
      }
    },
    [setSelectedFile, setActiveFolder],
  );

  return { syncFileTreeSelection };
}

/**
 * Hook for document buffer actions
 */
export function useDocumentBufferActions() {
  const removeBuffer = useDocumentBufferStore((state) => state.removeBuffer);
  return { removeBuffer };
}

/**
 * Combined hook for common editor operations
 */
export function useEditorOperations() {
  const { activeNote, activeNoteId, activeNoteFilePath, setActiveNote } = useNoteEditor();
  const { activeWorkspace } = useActiveWorkspace();
  const { syncFileTreeSelection } = useFileTreeActions();
  const { removeBuffer } = useDocumentBufferActions();

  return {
    // State
    activeNote,
    activeNoteId,
    activeNoteFilePath,
    activeWorkspace,
    // Actions
    setActiveNote,
    syncFileTreeSelection,
    removeBuffer,
  };
}
