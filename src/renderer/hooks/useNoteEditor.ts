/**
 * useNoteEditor Hook - Provides all state and actions for the note editor
 *
 * Abstracts store access per architecture rules:
 * Components → Hooks → Stores for shared state.
 *
 * activeNoteId is sourced from the route (see useActiveNoteId). The store
 * no longer mirrors it — if you need to change which note is active, use
 * useNavigateToNote instead of a setter.
 */

import { useMemo } from 'react';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useWorkspaceStore } from '@renderer/stores/workspaceStore';
import { useDocumentBufferStore } from '@renderer/stores/documentBufferStore';
import { useActiveNoteId } from '@renderer/navigation';

/**
 * Main hook for note editor state
 */
export function useNoteEditor() {
  const activeNoteId = useActiveNoteId();
  const notes = useNoteStore((state) => state.notes);

  const activeNote = useMemo(
    () => (activeNoteId ? notes.find((note) => note.id === activeNoteId) ?? null : null),
    [notes, activeNoteId],
  );

  const activeNoteFilePath = useMemo(
    () => (activeNote?.filePath ? activeNote.filePath.replace(/\\/g, '/') : ''),
    [activeNote?.filePath],
  );

  return {
    activeNote,
    activeNoteId,
    activeNoteFilePath,
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
  const { activeNote, activeNoteId, activeNoteFilePath } = useNoteEditor();
  const { activeWorkspace } = useActiveWorkspace();
  const { removeBuffer } = useDocumentBufferActions();

  return {
    // State
    activeNote,
    activeNoteId,
    activeNoteFilePath,
    activeWorkspace,
    // Actions
    removeBuffer,
  };
}
