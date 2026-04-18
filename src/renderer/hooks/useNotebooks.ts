import { useNotebookStore } from '@renderer/stores/notebookStore';

export function useNotebooks() {
  const notebooks = useNotebookStore((s) => s.notebooks);
  const activeNotebookId = useNotebookStore((s) => s.activeNotebookId);
  const expandedIds = useNotebookStore((s) => s.expandedIds);
  const setActiveNotebook = useNotebookStore((s) => s.setActiveNotebook);
  const toggleExpanded = useNotebookStore((s) => s.toggleExpanded);

  return {
    notebooks,
    activeNotebookId,
    expandedIds,
    setActiveNotebook,
    toggleExpanded,
  };
}
