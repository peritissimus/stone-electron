import { useNoteStore } from '@renderer/features/notes/model/noteStore';
import { useActiveNoteId } from '@renderer/services/navigation';

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
