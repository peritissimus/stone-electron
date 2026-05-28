/**
 * templatesStore — picker state + the two IPC calls (list, createNote).
 *
 * Picker flow:
 *   1. User opens picker → load templates if not already loaded
 *   2. User selects a template → if it has prompts, advance to the
 *      prompt-answers step; if not, create the note immediately
 *   3. User fills prompts + submits → create note → return noteId for
 *      the hook to navigate to
 */

import { create } from 'zustand';
import { templateAPI } from '@renderer/api';
import { handleIpcResponse } from '@renderer/lib/ipc';
import { logger } from '@renderer/lib/logger';
import type { Template } from '@shared/types';

export type PickerStep = 'picking' | 'filling-prompts' | 'creating';

interface TemplatesState {
  open: boolean;
  step: PickerStep;
  templates: Template[];
  loading: boolean;
  loadedOnce: boolean;
  error: string | null;
  selected: Template | null;
  /** Answers keyed by the prompt question text. */
  answers: Record<string, string>;
  creating: boolean;

  openPicker: () => void;
  closePicker: () => void;
  loadTemplates: () => Promise<void>;
  select: (template: Template) => void;
  back: () => void;
  setAnswer: (question: string, value: string) => void;
  /** Returns the new note id when successful so the caller can navigate. */
  createNote: () => Promise<string | null>;
}

const initial = {
  open: false,
  step: 'picking' as PickerStep,
  templates: [] as Template[],
  loading: false,
  loadedOnce: false,
  error: null as string | null,
  selected: null as Template | null,
  answers: {} as Record<string, string>,
  creating: false,
};

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  ...initial,

  openPicker: () => {
    set({ open: true, step: 'picking', selected: null, answers: {}, error: null });
    void get().loadTemplates();
  },
  closePicker: () => set({ ...initial }),

  loadTemplates: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const result = handleIpcResponse(await templateAPI.list(), 'Failed to load templates');
      if (!result.success) {
        set({ loading: false, loadedOnce: true, error: result.error });
        return;
      }
      set({ templates: result.data.templates, loading: false, loadedOnce: true });
    } catch (err) {
      logger.error('[templatesStore] load failed', err);
      set({
        loading: false,
        loadedOnce: true,
        error: err instanceof Error ? err.message : 'Failed to load templates',
      });
    }
  },

  select: (template) => {
    // Always advance to 'filling-prompts'; the hook detects the
    // no-prompt case and auto-submits so navigation happens in one
    // place (the hook, which has access to the router).
    const seeded: Record<string, string> = {};
    for (const q of template.prompts) seeded[q] = '';
    set({ selected: template, answers: seeded, step: 'filling-prompts' });
  },

  back: () => set({ selected: null, answers: {}, step: 'picking', error: null }),

  setAnswer: (question, value) =>
    set((state) => ({ answers: { ...state.answers, [question]: value } })),

  createNote: async () => {
    const { selected, answers } = get();
    if (!selected) return null;
    set({ creating: true, step: 'creating', error: null });
    try {
      const result = handleIpcResponse(
        await templateAPI.createNoteFromTemplate(selected.id, answers),
        'Failed to create note',
      );
      if (!result.success) {
        set({ creating: false, error: result.error, step: 'filling-prompts' });
        return null;
      }
      // Reset the picker — caller will navigate to the new note.
      set({ ...initial });
      return result.data.noteId;
    } catch (err) {
      logger.error('[templatesStore] create failed', err);
      set({
        creating: false,
        error: err instanceof Error ? err.message : 'Failed to create note',
        step: 'filling-prompts',
      });
      return null;
    }
  },
}));
