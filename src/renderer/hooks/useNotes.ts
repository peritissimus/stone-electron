import { useNoteStore } from '@renderer/stores/noteStore';

export function useNotes() {
  const notes = useNoteStore((s) => s.notes);
  const activeNoteId = useNoteStore((s) => s.activeNoteId);
  const notesByPath = useNoteStore((s) => s.notesByPath);
  const setActiveNote = useNoteStore((s) => s.setActiveNote);

  return {
    notes,
    activeNoteId,
    notesByPath,
    setActiveNote,
  };
}

export function getNotesByPathSnapshot() {
  return useNoteStore.getState().notesByPath;
}
