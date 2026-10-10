import { useNoteStore } from '@renderer/features/notes/model/noteStore';
import { useActiveNoteId } from '@renderer/services/navigation';
import { normalizePath } from '@renderer/lib/path';

/** Subscribe to one note so unrelated saves do not rerender every file row. */
export function useNoteByPath(path: string) {
  const normalizedPath = normalizePath(path);
  return useNoteStore((state) => state.notesByPath.get(normalizedPath));
}

export function useNotes() {
  const notes = useNoteStore((s) => s.notes);
  const notesByPath = useNoteStore((s) => s.notesByPath);
  const activeNoteId = useActiveNoteId();

  return {
    notes,
    activeNoteId,
    notesByPath,
  };
}

export function getNotesByPathSnapshot() {
  return useNoteStore.getState().notesByPath;
}
