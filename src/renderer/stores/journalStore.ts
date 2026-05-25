import { create } from 'zustand';
import { journalAPI, noteAPI } from '@renderer/api';
import { logger } from '@renderer/lib/logger';
import type { JournalEntry } from '@shared/schemas';
import type { Note } from '@shared/types';

export const JOURNAL_FEED_WINDOW_DAYS = 7;

interface NoteEventPayload {
  id?: string;
  note?: Note;
}

interface JournalState {
  entries: JournalEntry[];
  loading: boolean;
  loadedOnce: boolean;
  error: string | null;
  load: () => Promise<void>;
  materialize: (date: string) => Promise<string | null>;
  refreshForNoteEvent: (payload: unknown) => Promise<void>;
  reset: () => void;
}

function fileName(filePath: string | null): string | null {
  if (!filePath) return null;
  return filePath.split(/[\\/]/).pop() ?? null;
}

function matchesVisibleJournalEntry(note: Note, entries: JournalEntry[]): boolean {
  const name = fileName(note.filePath);
  return entries.some((entry) => entry.noteId === note.id || name === `${entry.date}.md`);
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

  refreshForNoteEvent: async (payload: unknown) => {
    const state = get();
    if (!state.loadedOnce) return;

    const data = (payload ?? {}) as NoteEventPayload;
    if (data.note && matchesVisibleJournalEntry(data.note, state.entries)) {
      await state.load();
      return;
    }

    if (!data.id) return;

    if (state.entries.some((entry) => entry.noteId === data.id)) {
      await state.load();
      return;
    }

    try {
      const response = await noteAPI.getById(data.id);
      if (
        response.success &&
        response.data &&
        matchesVisibleJournalEntry(response.data, get().entries)
      ) {
        await get().load();
      }
    } catch (error) {
      logger.debug('[journalStore] Ignoring note event that cannot be resolved', {
        id: data.id,
        error,
      });
    }
  },

  reset: () =>
    set({
      entries: [],
      loading: false,
      loadedOnce: false,
      error: null,
    }),
}));
