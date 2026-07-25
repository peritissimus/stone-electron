/**
 * Topic Store - Zustand state for semantic search and embedder readiness
 *
 * Topics themselves live in the main process and are organized there; the
 * renderer only tracks the search surface built on top of the index.
 */

import { create } from 'zustand';
import type { EmbeddingStatus, SimilarNote } from '@shared/types';

interface TopicState {
  // State
  embeddingStatus: EmbeddingStatus | null;
  searchResults: SimilarNote[];
  searchQuery: string;
  loading: boolean;
  error: string | null;
  workspaceId: string | null;
  initialized: boolean;

  // Actions
  setEmbeddingStatus: (status: EmbeddingStatus) => void;
  setSearchResults: (results: SimilarNote[]) => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  markInitialized: (workspaceId: string | null) => void;
  reset: () => void;
}

const initialState = {
  embeddingStatus: null,
  searchResults: [],
  searchQuery: '',
  loading: false,
  error: null,
  workspaceId: null,
  initialized: false,
};

export const useTopicStore = create<TopicState>((set) => ({
  ...initialState,

  setEmbeddingStatus: (status) => set({ embeddingStatus: status }),

  setSearchResults: (results) => set({ searchResults: results }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  markInitialized: (workspaceId) => set({ workspaceId, initialized: true }),

  reset: () => set(initialState),
}));
