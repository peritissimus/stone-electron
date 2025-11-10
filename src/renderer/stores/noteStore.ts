/**
 * Note Store - Zustand state management for notes
 */

import { create } from 'zustand';
import { Note } from '@shared/types';

interface NoteState {
  notes: Note[];
  activeNoteId: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  setNotes: (notes: Note[]) => void;
  addNote: (note: Note) => void;
  updateNote: (note: Note) => void;
  deleteNote: (id: string) => void;
  setActiveNote: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateNoteByPath: (filePath: string, updates: Partial<Note>) => void;
  removeNoteByPath: (filePath: string) => void;

  // Computed
  getActiveNote: () => Note | null;
  getNotesByNotebook: (notebookId: string) => Note[];
  getFavoriteNotes: () => Note[];
  getPinnedNotes: () => Note[];
  getArchivedNotes: () => Note[];
  getNoteByFilePath: (filePath: string) => Note | null;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  activeNoteId: null,
  loading: false,
  error: null,

  setNotes: (notes) => set({ notes }),

  addNote: (note) =>
    set((state) => ({
      notes: [note, ...state.notes],
    })),

  updateNote: (note) =>
    set((state) => ({
      notes: state.notes.map((n) => (n.id === note.id ? note : n)),
    })),

  deleteNote: (id) =>
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== id),
      activeNoteId: state.activeNoteId === id ? null : state.activeNoteId,
    })),

  setActiveNote: (id) => set({ activeNoteId: id }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  getActiveNote: () => {
    const state = get();
    return state.notes.find((n) => n.id === state.activeNoteId) || null;
  },

  getNotesByNotebook: (notebookId) => {
    return get().notes.filter((n) => n.notebookId === notebookId);
  },

  getFavoriteNotes: () => {
    return get().notes.filter((n) => n.isFavorite);
  },

  getPinnedNotes: () => {
    return get().notes.filter((n) => n.isPinned);
  },

  getArchivedNotes: () => {
    return get().notes.filter((n) => n.isArchived);
  },

  getNoteByFilePath: (filePath) => {
    if (!filePath) return null;
    // Normalize the input path: convert backslashes, remove leading/trailing slashes
    const normalized = filePath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    return get().notes.find((n) => {
      if (!n.filePath) return false;
      // Normalize the note's file path the same way
      const notePathNormalized = n.filePath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
      return notePathNormalized === normalized;
    }) || null;
  },

  updateNoteByPath: (filePath, updates) =>
    set((state) => {
      // Normalize the input path: convert backslashes, remove leading/trailing slashes
      const normalized = filePath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
      return {
        notes: state.notes.map((n) => {
          if (!n.filePath) return n;
          // Normalize the note's file path the same way
          const notePathNormalized = n.filePath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
          return notePathNormalized === normalized ? { ...n, ...updates } : n;
        }),
      };
    }),

  removeNoteByPath: (filePath) =>
    set((state) => {
      // Normalize the input path: convert backslashes, remove leading/trailing slashes
      const normalized = filePath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
      const removedNote = state.notes.find((n) => {
        if (!n.filePath) return false;
        const notePathNormalized = n.filePath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
        return notePathNormalized === normalized;
      });
      return {
        notes: state.notes.filter((n) => {
          if (!n.filePath) return true;
          const notePathNormalized = n.filePath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
          return notePathNormalized !== normalized;
        }),
        activeNoteId:
          removedNote && state.activeNoteId === removedNote.id ? null : state.activeNoteId,
      };
    }),
}));
