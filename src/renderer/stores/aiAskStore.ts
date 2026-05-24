/**
 * AI Ask Store - state for the "Ask Notes" panel.
 *
 * Owns the in-flight query, last answer, and cited sources. The hook layer
 * (useAskNotes) reads/writes through this store; the panel component never
 * touches the api directly.
 */

import { create } from 'zustand';
import { aiAPI, type AskNotesResponseDTO, type CitationSourceDTO } from '@renderer/api';
import { useWorkspaceStore } from './workspaceStore';

interface AskNotesHistoryEntry {
  query: string;
  answer: string;
  sources: CitationSourceDTO[];
  askedAt: number;
}

interface AIAskState {
  query: string;
  answer: string;
  sources: CitationSourceDTO[];
  loading: boolean;
  error: string | null;
  lastAskedAt: number | null;
  history: AskNotesHistoryEntry[];
  setQuery: (query: string) => void;
  ask: (query?: string) => Promise<AskNotesResponseDTO | null>;
  clear: () => void;
}

const HISTORY_LIMIT = 10;

export const useAIAskStore = create<AIAskState>((set, get) => ({
  query: '',
  answer: '',
  sources: [],
  loading: false,
  error: null,
  lastAskedAt: null,
  history: [],

  setQuery: (query) => set({ query }),

  ask: async (queryOverride) => {
    const question = (queryOverride ?? get().query).trim();
    if (!question || get().loading) return null;

    const workspaceId = useWorkspaceStore.getState().activeWorkspaceId ?? undefined;

    set({ loading: true, error: null, query: question });

    try {
      const response = await aiAPI.askNotes({ query: question, workspaceId });
      if (!response.success || !response.data) {
        const message = response.error?.message ?? 'Failed to ask notes';
        set({ loading: false, error: message });
        return null;
      }

      const { answer, sources } = response.data;
      const askedAt = Date.now();
      const nextEntry: AskNotesHistoryEntry = { query: question, answer, sources, askedAt };

      set((state) => ({
        answer,
        sources,
        loading: false,
        error: null,
        lastAskedAt: askedAt,
        history: [nextEntry, ...state.history].slice(0, HISTORY_LIMIT),
      }));

      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to ask notes';
      set({ loading: false, error: message });
      return null;
    }
  },

  clear: () =>
    set({ query: '', answer: '', sources: [], error: null, lastAskedAt: null, loading: false }),
}));
