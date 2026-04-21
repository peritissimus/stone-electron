import { useNoteStore } from '@renderer/stores/noteStore';
import { useActiveNoteId } from '@renderer/navigation';

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
