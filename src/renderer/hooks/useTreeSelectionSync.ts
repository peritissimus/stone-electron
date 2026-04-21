import { useEffect } from 'react';
import { useActiveNoteId } from '@renderer/navigation';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { normalizePath } from '@renderer/lib/path';

/**
 * Derives file-tree highlight state (selectedFile, activeFolder) from the
 * active note. Mount once at the top of the app tree.
 *
 * This is the ONLY place that should call setSelectedFile / setActiveFolder
 * in response to note navigation. Individual "open a note" call sites must
 * use useNavigateToNote and stop touching fileTreeStore directly.
 */
export function useTreeSelectionSync() {
  const activeNoteId = useActiveNoteId();
  const notes = useNoteStore((s) => s.notes);
  const setSelectedFile = useFileTreeStore((s) => s.setSelectedFile);
  const setActiveFolder = useFileTreeStore((s) => s.setActiveFolder);

  useEffect(() => {
    if (!activeNoteId) return;
    const note = notes.find((n) => n.id === activeNoteId);
    if (!note?.filePath) return;

    const normalized = normalizePath(note.filePath);
    setSelectedFile(normalized);

    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash > 0) {
      setActiveFolder(normalized.substring(0, lastSlash));
    }
  }, [activeNoteId, notes, setSelectedFile, setActiveFolder]);
}
