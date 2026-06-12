/**
 * useTemplates — read/orchestrate the template picker. The hook owns
 * navigation after a successful create; the store owns IPC and state.
 */

import { useCallback, useEffect } from 'react';
import { useTemplatesStore } from '@renderer/stores/templatesStore';
import { useNavigateToNote } from '@renderer/navigation';

export function useTemplates() {
  const open = useTemplatesStore((s) => s.open);
  const step = useTemplatesStore((s) => s.step);
  const templates = useTemplatesStore((s) => s.templates);
  const loading = useTemplatesStore((s) => s.loading);
  const loadedOnce = useTemplatesStore((s) => s.loadedOnce);
  const error = useTemplatesStore((s) => s.error);
  const selected = useTemplatesStore((s) => s.selected);
  const answers = useTemplatesStore((s) => s.answers);
  const creating = useTemplatesStore((s) => s.creating);

  const openPicker = useTemplatesStore((s) => s.openPicker);
  const closePicker = useTemplatesStore((s) => s.closePicker);
  const select = useTemplatesStore((s) => s.select);
  const back = useTemplatesStore((s) => s.back);
  const setAnswer = useTemplatesStore((s) => s.setAnswer);
  const createNoteAction = useTemplatesStore((s) => s.createNote);

  const navigateToNote = useNavigateToNote();

  const submit = useCallback(async () => {
    const noteId = await createNoteAction();
    if (noteId) navigateToNote(noteId);
  }, [createNoteAction, navigateToNote]);

  // Fast path for templates with no prompts: as soon as a no-prompt
  // template is selected, fire submit() so the user gets one-click
  // creation. Guarded against re-triggering by the `creating` flag.
  useEffect(() => {
    if (
      selected &&
      selected.prompts.length === 0 &&
      step === 'filling-prompts' &&
      !creating
    ) {
      void submit();
    }
  }, [selected, step, creating]);

  return {
    open,
    step,
    templates,
    loading,
    loadedOnce,
    error,
    selected,
    answers,
    creating,
    openPicker,
    closePicker,
    select,
    back,
    setAnswer,
    submit,
  };
}
