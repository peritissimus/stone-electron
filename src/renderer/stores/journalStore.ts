import { create } from 'zustand';
import { journalAPI } from '@renderer/api';
import { useDocumentBufferStore } from '@renderer/stores/documentBufferStore';
import { parseMarkdown } from '@renderer/lib/markdownParser';
import { logger } from '@renderer/lib/logger';
import type { JournalEntry } from '@shared/schemas';

export const JOURNAL_FEED_WINDOW_DAYS = 7;

interface JournalState {
  entries: JournalEntry[];
  loading: boolean;
  loadedOnce: boolean;
  error: string | null;
  load: () => Promise<void>;
  materialize: (date: string) => Promise<void>;
  reset: () => void;
}

/**
 * Hydrate the documentBufferStore with markdown that arrived in the timeline
 * payload, so each per-day TipTap editor can mount without an extra IPC
 * round-trip. Skip notes that already have a buffer — the user may be in the
 * middle of editing them, and we'd otherwise discard their unsaved work.
 */
function preloadDocumentBuffers(entries: JournalEntry[]): void {
  const bufferStore = useDocumentBufferStore.getState();
  for (const entry of entries) {
    if (!entry.noteId || entry.content === null) continue;
    if (bufferStore.hasBuffer(entry.noteId)) continue;
    try {
      const json = parseMarkdown(entry.content);
      bufferStore.setBuffer(entry.noteId, json);
    } catch (error) {
      logger.error('[journalStore] Failed to parse journal markdown', { date: entry.date, error });
    }
  }
}

export const useJournalStore = create<JournalState>()((set, get) => ({
  entries: [],
  loading: false,
  loadedOnce: false,
  error: null,

  load: async () => {
    if (get().loading) return;

    set({ loading: true, error: null });
    try {
      const response = await journalAPI.listRange({ limit: JOURNAL_FEED_WINDOW_DAYS });

      if (!response.success || !response.data) {
        set({
          error: response.error?.message || 'Failed to load journals',
          loading: false,
          loadedOnce: true,
        });
        return;
      }

      const { entries } = response.data;
      preloadDocumentBuffers(entries);

      set({
        entries,
        loading: false,
        loadedOnce: true,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load journals',
        loading: false,
        loadedOnce: true,
      });
    }
  },

  materialize: async (date: string) => {
    const response = await journalAPI.openOrCreateForDate(date);
    if (!response.success || !response.data) {
      logger.error('[journalStore] Failed to materialize journal day', {
        date,
        error: response.error,
      });
      return;
    }

    const { noteId } = response.data;
    // Seed an empty buffer so the editor that's about to mount doesn't
    // round-trip to disk for a freshly-created file we know is empty.
    const bufferStore = useDocumentBufferStore.getState();
    if (!bufferStore.hasBuffer(noteId)) {
      bufferStore.setBuffer(noteId, { type: 'doc', content: [] });
    }

    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.date === date ? { ...entry, noteId, exists: true, content: '' } : entry,
      ),
    }));
  },

  reset: () =>
    set({
      entries: [],
      loading: false,
      loadedOnce: false,
      error: null,
    }),
}));
