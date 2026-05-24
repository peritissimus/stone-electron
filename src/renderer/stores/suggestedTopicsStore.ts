/**
 * Suggested Topics store — caches the latest cluster suggestions and tracks
 * which ones the user has dismissed in this session.
 *
 * Dismissals are renderer-only for now. If/when we want them to survive a
 * restart, a `dismissed_suggestions` table keyed by sorted chunk-id signature
 * would do it without changing this store's shape.
 */

import { create } from 'zustand';
import type { SuggestedTopic } from '@shared/types';
import { topicAPI } from '@renderer/api/topicAPI';

interface SuggestedTopicsState {
  suggestions: SuggestedTopic[];
  dismissed: Set<string>;
  loading: boolean;
  adopting: string | null;
  error: string | null;
  hasLoadedOnce: boolean;
  refresh: () => Promise<void>;
  dismiss: (id: string) => void;
  adopt: (suggestionId: string, name: string, color?: string) => Promise<boolean>;
}

export const useSuggestedTopicsStore = create<SuggestedTopicsState>((set, get) => ({
  suggestions: [],
  dismissed: new Set(),
  loading: false,
  adopting: null,
  error: null,
  hasLoadedOnce: false,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const res = await topicAPI.getSuggestions();
      if (res.success && res.data) {
        set({
          suggestions: res.data.suggestions,
          loading: false,
          hasLoadedOnce: true,
        });
      } else {
        set({
          loading: false,
          error: res.error?.message ?? 'Failed to load suggestions',
          hasLoadedOnce: true,
        });
      }
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load suggestions',
        hasLoadedOnce: true,
      });
    }
  },

  dismiss: (id) => {
    const next = new Set(get().dismissed);
    next.add(id);
    set({ dismissed: next });
  },

  adopt: async (suggestionId, name, color) => {
    const suggestion = get().suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return false;
    set({ adopting: suggestionId, error: null });
    try {
      const res = await topicAPI.adoptSuggestion({
        name,
        color,
        noteIds: suggestion.noteIds,
      });
      if (res.success && res.data) {
        // Drop the adopted suggestion from the visible list immediately.
        set({
          adopting: null,
          suggestions: get().suggestions.filter((s) => s.id !== suggestionId),
        });
        return true;
      }
      set({ adopting: null, error: res.error?.message ?? 'Failed to adopt suggestion' });
      return false;
    } catch (err) {
      set({
        adopting: null,
        error: err instanceof Error ? err.message : 'Failed to adopt suggestion',
      });
      return false;
    }
  },
}));
