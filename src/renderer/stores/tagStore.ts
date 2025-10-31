/**
 * Tag Store - Zustand state management for tags
 */

import { create } from 'zustand';
import { Tag, TagWithCount } from '@shared/types';

interface TagState {
  tags: TagWithCount[];
  selectedTagIds: string[];
  loading: boolean;
  error: string | null;

  // Actions
  setTags: (tags: TagWithCount[]) => void;
  addTag: (tag: TagWithCount) => void;
  updateTag: (tag: Tag) => void;
  deleteTag: (id: string) => void;
  selectTag: (id: string) => void;
  deselectTag: (id: string) => void;
  toggleTag: (id: string) => void;
  clearSelection: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Computed
  getSelectedTags: () => TagWithCount[];
  getTagById: (id: string) => TagWithCount | null;
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  selectedTagIds: [],
  loading: false,
  error: null,

  setTags: (tags) => set({ tags }),

  addTag: (tag) =>
    set((state) => ({
      tags: [...state.tags, tag].sort((a, b) => a.name.localeCompare(b.name)),
    })),

  updateTag: (tag) =>
    set((state) => ({
      tags: state.tags.map((t) => (t.id === tag.id ? { ...t, ...tag } : t)),
    })),

  deleteTag: (id) =>
    set((state) => ({
      tags: state.tags.filter((t) => t.id !== id),
      selectedTagIds: state.selectedTagIds.filter((tid) => tid !== id),
    })),

  selectTag: (id) =>
    set((state) => ({
      selectedTagIds: state.selectedTagIds.includes(id)
        ? state.selectedTagIds
        : [...state.selectedTagIds, id],
    })),

  deselectTag: (id) =>
    set((state) => ({
      selectedTagIds: state.selectedTagIds.filter((tid) => tid !== id),
    })),

  toggleTag: (id) =>
    set((state) => ({
      selectedTagIds: state.selectedTagIds.includes(id)
        ? state.selectedTagIds.filter((tid) => tid !== id)
        : [...state.selectedTagIds, id],
    })),

  clearSelection: () => set({ selectedTagIds: [] }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  getSelectedTags: () => {
    const state = get();
    return state.tags.filter((t) => state.selectedTagIds.includes(t.id));
  },

  getTagById: (id) => {
    return get().tags.find((t) => t.id === id) || null;
  },
}));
