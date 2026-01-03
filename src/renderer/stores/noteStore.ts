/**
 * Note Store - Zustand state management for notes
 *
 * Pattern: specs/stores.ts#NoteStoreState
 */

import { create } from 'zustand';
import { Note } from '@shared/types';
import { normalizePath } from '@renderer/utils/pathCache';

interface NoteState {
  notes: Note[];
  notesByPath: Map<string, Note>; // O(1) lookup index
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
  rebuildPathIndex: () => void;

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
  notesByPath: new Map(),
  activeNoteId: null,
  loading: false,
  error: null,

  setNotes: (notes) => {
    const notesByPath = new Map<string, Note>();
    notes.forEach((note) => {
      if (note.filePath) {
        const normalized = normalizePath(note.filePath);
        notesByPath.set(normalized, note);
      }
    });
    set({ notes, notesByPath });
  },

  addNote: (note) =>
    set((state) => {
      // Check if note already exists (prevent duplicates)
      if (state.notes.some((n) => n.id === note.id)) {
        return state;
      }

      const notesByPath = new Map(state.notesByPath);
      if (note.filePath) {
        const normalized = normalizePath(note.filePath);
        notesByPath.set(normalized, note);
      }
      return {
        notes: [note, ...state.notes],
        notesByPath,
      };
    }),

  updateNote: (note) =>
    set((state) => {
      const notes = state.notes.map((n) => (n.id === note.id ? note : n));
      const notesByPath = new Map(state.notesByPath);

      // Remove old path entry if it exists
      const oldNote = state.notes.find((n) => n.id === note.id);
      if (oldNote?.filePath) {
        const oldNormalized = normalizePath(oldNote.filePath);
        notesByPath.delete(oldNormalized);
      }

      // Add new path entry
      if (note.filePath) {
        const normalized = normalizePath(note.filePath);
        notesByPath.set(normalized, note);
      }

      return { notes, notesByPath };
    }),

  deleteNote: (id) =>
    set((state) => {
      const note = state.notes.find((n) => n.id === id);
      const notesByPath = new Map(state.notesByPath);

      if (note?.filePath) {
        const normalized = normalizePath(note.filePath);
        notesByPath.delete(normalized);
      }

      return {
        notes: state.notes.filter((n) => n.id !== id),
        notesByPath,
        activeNoteId: state.activeNoteId === id ? null : state.activeNoteId,
      };
    }),

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
    const normalized = normalizePath(filePath);
    return get().notesByPath.get(normalized) || null;
  },

  updateNoteByPath: (filePath, updates) =>
    set((state) => {
      const normalized = normalizePath(filePath);
      const note = state.notesByPath.get(normalized);

      if (!note) return state;

      const updatedNote = { ...note, ...updates };
      const notes = state.notes.map((n) => (n.id === note.id ? updatedNote : n));
      const notesByPath = new Map(state.notesByPath);

      // Update index if filePath changed
      if (updates.filePath && updates.filePath !== note.filePath) {
        notesByPath.delete(normalized);
        const newNormalized = normalizePath(updates.filePath);
        notesByPath.set(newNormalized, updatedNote);
      } else {
        notesByPath.set(normalized, updatedNote);
      }

      return { notes, notesByPath };
    }),

  removeNoteByPath: (filePath) =>
    set((state) => {
      const normalized = normalizePath(filePath);
      const removedNote = state.notesByPath.get(normalized);

      if (!removedNote) return state;

      const notesByPath = new Map(state.notesByPath);
      notesByPath.delete(normalized);

      return {
        notes: state.notes.filter((n) => n.id !== removedNote.id),
        notesByPath,
        activeNoteId:
          state.activeNoteId === removedNote.id ? null : state.activeNoteId,
      };
    }),

  rebuildPathIndex: () =>
    set((state) => {
      const notesByPath = new Map<string, Note>();
      state.notes.forEach((note) => {
        if (note.filePath) {
          notesByPath.set(normalizePath(note.filePath), note);
        }
      });
      return { notesByPath };
    }),
}));
