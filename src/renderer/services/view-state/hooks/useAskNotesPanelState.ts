import { useUIStore } from '@renderer/services/view-state/model/uiStore';

export function useAskNotesPanelState() {
  const open = useUIStore((state) => state.askNotesOpen);
  const close = useUIStore((state) => state.closeAskNotes);
  return { open, close };
}
