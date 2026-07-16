import { useUIStore } from '@renderer/services/view-state/model/uiStore';

export function useWorkbenchCommands() {
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const toggleCommandCenter = useUIStore((state) => state.toggleCommandCenter);
  const toggleFindReplace = useUIStore((state) => state.toggleFindReplace);
  const toggleEditorMode = useUIStore((state) => state.toggleEditorMode);
  const toggleAskNotes = useUIStore((state) => state.toggleAskNotes);

  return {
    toggleSidebar,
    toggleCommandCenter,
    toggleFindReplace,
    toggleEditorMode,
    toggleAskNotes,
  };
}
