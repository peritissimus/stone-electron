import { useCallback, useEffect } from 'react';
import { useJournalActions } from '@renderer/hooks/useJournalActions';
import { useJournalStore } from '@renderer/stores/journalStore';
import { useDocumentBufferStore } from '@renderer/stores/documentBufferStore';
import type { JournalEntry } from '@shared/schemas';

/**
 * Hydrate the documentBufferStore with markdown that arrived in the timeline
 * payload, so each per-day rich-text editor can mount without an extra IPC
 * round-trip. Skip notes that already have a buffer because the user may have
 * unsaved edits in that buffer.
 */
function preloadDocumentBuffers(entries: JournalEntry[]): void {
  const bufferStore = useDocumentBufferStore.getState();
  for (const entry of entries) {
    if (!entry.noteId || entry.content === null) continue;
    if (bufferStore.hasBuffer(entry.noteId)) continue;
    bufferStore.setBuffer(entry.noteId, entry.content);
  }
}

function seedEmptyDocumentBuffer(noteId: string): void {
  const bufferStore = useDocumentBufferStore.getState();
  if (!bufferStore.hasBuffer(noteId)) {
    bufferStore.setBuffer(noteId, '');
  }
}

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

  useEffect(() => {
    preloadDocumentBuffers(entries);
  }, [entries]);

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
      const noteId = await materialize(date);
      if (noteId) {
        seedEmptyDocumentBuffer(noteId);
      }
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
