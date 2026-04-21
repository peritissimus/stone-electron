import { useMemo } from 'react';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useActiveNoteId } from '@renderer/navigation';
import { normalizePath } from '@renderer/lib/path';

/**
 * Pure derivation: the "selected file" and "active folder" are whatever
 * the route says is open. No store writes, no effect loops.
 *
 *   /note/:noteId → look up note.filePath → { selectedFile, activeFolder }
 *   everything else → { null, null }
 */
export function useTreeSelection(): {
  selectedFile: string | null;
  activeFolder: string | null;
} {
  const activeNoteId = useActiveNoteId();
  const notes = useNoteStore((s) => s.notes);

  return useMemo(() => {
    if (!activeNoteId) return { selectedFile: null, activeFolder: null };
    const note = notes.find((n) => n.id === activeNoteId);
    if (!note?.filePath) return { selectedFile: null, activeFolder: null };

    const selectedFile = normalizePath(note.filePath);
    const lastSlash = selectedFile.lastIndexOf('/');
    const activeFolder = lastSlash > 0 ? selectedFile.substring(0, lastSlash) : null;
    return { selectedFile, activeFolder };
  }, [activeNoteId, notes]);
}
