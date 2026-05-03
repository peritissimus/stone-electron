import { create } from 'zustand';
import { journalAPI } from '@renderer/api';
import { logger } from '@renderer/lib/logger';
import type { JournalEntry } from '@shared/schemas';

export const JOURNAL_FEED_WINDOW_DAYS = 7;

interface JournalState {
  entries: JournalEntry[];
  loading: boolean;
  loadedOnce: boolean;
  error: string | null;
  load: () => Promise<void>;
  materialize: (date: string) => Promise<string | null>;
  reset: () => void;
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

      set({
        entries: response.data.entries,
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
      return null;
    }

    const { noteId } = response.data;

    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.date === date ? { ...entry, noteId, exists: true, content: '' } : entry,
      ),
    }));

    return noteId;
  },

  reset: () =>
    set({
      entries: [],
      loading: false,
      loadedOnce: false,
      error: null,
    }),
}));
