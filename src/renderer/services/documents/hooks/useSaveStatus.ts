/**
 * Save state for one note, reduced to something a status line can render.
 *
 * Views read this instead of the buffer and save-status stores directly, so the
 * "is it dirty, is a write in flight, did the last one fail" reasoning lives in
 * one place rather than in every surface that wants to display it.
 */

import { useCallback } from 'react';
import { useDocumentBufferStore } from '@renderer/services/documents/model/documentBufferStore';
import {
  useSaveStatusStore,
  type SaveStatus,
} from '@renderer/services/documents/model/saveStatusStore';
import { useDocumentAutosave } from './useDocumentBuffer';

export type { SaveStatus };

export interface UseSaveStatusResult {
  status: SaveStatus;
  /** Present only when status is 'error'. */
  error: string | undefined;
  /** Re-attempt the write for this note. */
  retry: () => void;
}

export function useSaveStatus(noteId: string | null): UseSaveStatusResult {
  const buffers = useDocumentBufferStore((state) => state.buffers);
  const savingIds = useSaveStatusStore((state) => state.savingIds);
  const errors = useSaveStatusStore((state) => state.errors);
  const { saveNote } = useDocumentAutosave();

  const error = noteId ? errors.get(noteId) : undefined;
  const isSaving = noteId ? savingIds.has(noteId) : false;
  const isDirty = noteId ? (buffers.get(noteId)?.isDirty ?? false) : false;

  const retry = useCallback(() => {
    if (noteId) void saveNote(noteId);
  }, [noteId, saveNote]);

  const status: SaveStatus = error
    ? 'error'
    : isSaving
      ? 'saving'
      : isDirty
        ? 'unsaved'
        : 'saved';

  return { status, error, retry };
}
