import { useCallback, useEffect } from 'react';
import { useJournalActions } from '@renderer/hooks/useJournalActions';
import { useJournalStore } from '@renderer/stores/journalStore';

export function useJournalTimeline() {
  const entries = useJournalStore((state) => state.entries);
  const loading = useJournalStore((state) => state.loading);
  const loadedOnce = useJournalStore((state) => state.loadedOnce);
  const error = useJournalStore((state) => state.error);
  const load = useJournalStore((state) => state.load);
  const materialize = useJournalStore((state) => state.materialize);
  const reset = useJournalStore((state) => state.reset);
  const { navigateToNote } = useJournalActions();

  useEffect(() => {
    void load();
    return () => reset();
  }, [load, reset]);

  // Open a day in the dedicated single-note editor (separate from the inline
  // timeline editor). Used by the date-heading button + the corner action icon.
  const handleEntryOpen = useCallback(
    async (_date: string, noteId: string | null) => {
      if (!noteId) return; // empty days are handled inline via materialize
      navigateToNote(noteId);
    },
    [navigateToNote],
  );

  const handleMaterialize = useCallback(
    async (date: string) => {
      await materialize(date);
    },
    [materialize],
  );

  return {
    entries,
    loading,
    loadedOnce,
    error,
    handleEntryOpen,
    handleMaterialize,
  };
}
