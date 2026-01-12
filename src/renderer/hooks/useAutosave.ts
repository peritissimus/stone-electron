/**
 * Autosave Hook - Handles title autosave only
 *
 * Content is saved via useDocumentAutosave (on blur, note switch, app close).
 * This hook only handles title changes with a short debounce.
 */

import { useEffect, useRef, useCallback } from 'react';
import { logger } from '@renderer/utils/logger';

export interface UseAutosaveOptions {
  updateNote: (
    noteId: string,
    data: { content?: string; title?: string; folderPath?: string; notebookId?: string },
    silent?: boolean,
  ) => Promise<any>;
  activeNoteId: string | undefined;
}

export function useAutosave({ updateNote, activeNoteId }: UseAutosaveOptions) {
  const saveTimeoutRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Debounced title save (shorter debounce for titles since they're small)
  const saveTitle = useCallback(
    async (title: string) => {
      if (!activeNoteId) return;

      // Clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      const noteId = activeNoteId;
      const timeout = window.setTimeout(async () => {
        saveTimeoutRef.current = null;
        isSavingRef.current = true;
        try {
          // Use silent=true to save without triggering store update/re-render
          const result = await updateNote(noteId, { title }, true);
          if (!result) {
            logger.error('Title autosave failed: updateNote returned falsy result');
          }
        } catch (error) {
          logger.error('Title autosave failed:', error);
        } finally {
          isSavingRef.current = false;
        }
      }, 500);
      saveTimeoutRef.current = timeout;
    },
    [activeNoteId, updateNote],
  );

  return {
    saveTitle,
  };
}
