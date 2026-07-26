/**
 * Save status per note, so the editor can report what happened to the writes
 * the autosave performs on the reader's behalf.
 *
 * Kept apart from the document buffer store because that store evicts buffers
 * under an LRU policy — a failed save has to stay reportable even if its buffer
 * is no longer the one on screen.
 */

import { create } from 'zustand';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface SaveStatusState {
  savingIds: Set<string>;
  errors: Map<string, string>;
  lastSavedAt: Map<string, number>;

  markSaving: (noteId: string) => void;
  markSaved: (noteId: string) => void;
  markFailed: (noteId: string, message: string) => void;
  clearError: (noteId: string) => void;

  isSaving: (noteId: string) => boolean;
  getError: (noteId: string) => string | undefined;
}

export const useSaveStatusStore = create<SaveStatusState>((set, get) => ({
  savingIds: new Set(),
  errors: new Map(),
  lastSavedAt: new Map(),

  markSaving: (noteId) =>
    set((state) => {
      const savingIds = new Set(state.savingIds);
      savingIds.add(noteId);
      // A retry supersedes the previous failure.
      const errors = new Map(state.errors);
      errors.delete(noteId);
      return { savingIds, errors };
    }),

  markSaved: (noteId) =>
    set((state) => {
      const savingIds = new Set(state.savingIds);
      savingIds.delete(noteId);
      const errors = new Map(state.errors);
      errors.delete(noteId);
      const lastSavedAt = new Map(state.lastSavedAt);
      lastSavedAt.set(noteId, Date.now());
      return { savingIds, errors, lastSavedAt };
    }),

  markFailed: (noteId, message) =>
    set((state) => {
      const savingIds = new Set(state.savingIds);
      savingIds.delete(noteId);
      const errors = new Map(state.errors);
      errors.set(noteId, message);
      return { savingIds, errors };
    }),

  clearError: (noteId) =>
    set((state) => {
      const errors = new Map(state.errors);
      errors.delete(noteId);
      return { errors };
    }),

  isSaving: (noteId) => get().savingIds.has(noteId),
  getError: (noteId) => get().errors.get(noteId),
}));
