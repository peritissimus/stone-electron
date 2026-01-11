/**
 * Topic Store - Zustand state management for topics and semantic search
 *
 * Pattern: specs/stores.ts#SingleSelectStore
 */

import { create } from 'zustand';
import type { TopicWithCount, EmbeddingStatus, SimilarNote } from '@shared/types';

interface TopicState {
  // State
  topics: TopicWithCount[];
  selectedTopicId: string | null;
  embeddingStatus: EmbeddingStatus | null;
  searchResults: SimilarNote[];
  searchQuery: string;
  loading: boolean;
  classifying: boolean;
  error: string | null;

  // Actions
  setTopics: (topics: TopicWithCount[]) => void;
  addTopic: (topic: TopicWithCount) => void;
  updateTopic: (id: string, updates: Partial<TopicWithCount>) => void;
  deleteTopic: (id: string) => void;
  selectTopic: (id: string | null) => void;
  setEmbeddingStatus: (status: EmbeddingStatus) => void;
  setSearchResults: (results: SimilarNote[]) => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setClassifying: (classifying: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;

  // Computed
  getTopicById: (id: string) => TopicWithCount | null;
  getPredefinedTopics: () => TopicWithCount[];
  getCustomTopics: () => TopicWithCount[];
  getTotalNoteCount: () => number;
}

const initialState = {
  topics: [],
  selectedTopicId: null,
  embeddingStatus: null,
  searchResults: [],
  searchQuery: '',
  loading: false,
  classifying: false,
  error: null,
};

export const useTopicStore = create<TopicState>((set, get) => ({
  ...initialState,

  setTopics: (topics) => set({ topics }),

  addTopic: (topic) =>
    set((state) => ({
      topics: [...state.topics, topic].sort((a, b) => {
        // Predefined topics first, then alphabetically
        if (a.isPredefined && !b.isPredefined) return -1;
        if (!a.isPredefined && b.isPredefined) return 1;
        return a.name.localeCompare(b.name);
      }),
    })),

  updateTopic: (id, updates) =>
    set((state) => ({
      topics: state.topics.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  deleteTopic: (id) =>
    set((state) => ({
      topics: state.topics.filter((t) => t.id !== id),
      selectedTopicId: state.selectedTopicId === id ? null : state.selectedTopicId,
    })),

  selectTopic: (id) => set({ selectedTopicId: id }),

  setEmbeddingStatus: (status) => set({ embeddingStatus: status }),

  setSearchResults: (results) => set({ searchResults: results }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setLoading: (loading) => set({ loading }),

  setClassifying: (classifying) => set({ classifying }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),

  getTopicById: (id) => {
    return get().topics.find((t) => t.id === id) || null;
  },

  getPredefinedTopics: () => {
    return get().topics.filter((t) => t.isPredefined);
  },

  getCustomTopics: () => {
    return get().topics.filter((t) => !t.isPredefined);
  },

  getTotalNoteCount: () => {
    return get().topics.reduce((sum, t) => sum + (t.noteCount || 0), 0);
  },
}));
