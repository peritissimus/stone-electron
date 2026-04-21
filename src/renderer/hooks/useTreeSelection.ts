import { useMemo } from 'react';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useActiveNoteId } from '@renderer/navigation';
import { normalizePath } from '@renderer/lib/path';
import type { Note } from '@shared/types';

export interface TreeSelection {
  selectedFile: string | null;
  activeFolder: string | null;
}

const EMPTY_SELECTION: TreeSelection = { selectedFile: null, activeFolder: null };

/**
 * Pure derivation — exported so it can be unit-tested without a router or
 * a zustand store. Given the active note id and the current notes collection,
 * compute the file/folder the tree should highlight.
 */
export function deriveTreeSelection(
  activeNoteId: string | null,
  notes: readonly Note[],
): TreeSelection {
  if (!activeNoteId) return EMPTY_SELECTION;
  const note = notes.find((n) => n.id === activeNoteId);
  if (!note?.filePath) return EMPTY_SELECTION;

  const selectedFile = normalizePath(note.filePath);
  const lastSlash = selectedFile.lastIndexOf('/');
  const activeFolder = lastSlash > 0 ? selectedFile.substring(0, lastSlash) : null;
  return { selectedFile, activeFolder };
}

/**
 * Pure derivation from the route: the "selected file" and "active folder"
 * are whatever the route says is open. No store writes, no effect loops.
 *
 *   /note/:noteId → look up note.filePath → { selectedFile, activeFolder }
 *   everything else → { null, null }
 */
export function useTreeSelection(): TreeSelection {
  const activeNoteId = useActiveNoteId();
  const notes = useNoteStore((s) => s.notes);

  return useMemo(() => deriveTreeSelection(activeNoteId, notes), [activeNoteId, notes]);
}
