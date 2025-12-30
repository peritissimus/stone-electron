/**
 * Autosave Hook - Handles all autosave logic for notes
 */

import { useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { jsonToMarkdown } from '../utils/jsonToMarkdown';
import { logger } from '@renderer/utils/logger';

export interface UseAutosaveOptions {
  updateNote: (
    noteId: string,
    data: { content?: string; title?: string; folderPath?: string; notebookId?: string },
    silent?: boolean,
  ) => Promise<any>;
  activeNoteId: string | undefined;
  editor: Editor | null;
}

export function useAutosave({ updateNote, activeNoteId, editor }: UseAutosaveOptions) {
  const saveTimeoutRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);
  const activeNoteIdRef = useRef<string | null>(activeNoteId ?? null);

  // Keep activeNoteIdRef in sync
  useEffect(() => {
    activeNoteIdRef.current = activeNoteId ?? null;
  }, [activeNoteId]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Autosave on window blur
  useEffect(() => {
    const handleWindowBlur = () => {
      const noteId = activeNoteIdRef.current;
      if (noteId && editor && saveTimeoutRef.current) {
        // Clear pending timeout and save immediately
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        isSavingRef.current = true;
        const jsonContent = editor.getJSON();
        const markdownContent = jsonToMarkdown(jsonContent);
        logger.debug('Blur autosave JSON->Markdown result:', markdownContent.substring(0, 500));
        // Use silent=true to save without triggering store update/re-render
        updateNote(noteId, { content: markdownContent }, true)
          .then((result) => {
            if (!result) {
              logger.error('Blur autosave failed: updateNote returned falsy result');
            }
          })
          .catch((error) => {
            logger.error('Blur autosave failed:', error);
          })
          .finally(() => {
            isSavingRef.current = false;
          });
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSavingRef.current || saveTimeoutRef.current) {
        // Show confirmation dialog if save is in progress
        e.preventDefault();
        e.returnValue = 'Changes are being saved. Are you sure you want to leave?';
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('blur-sm', handleWindowBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [editor, updateNote]);

  // Setup editor content change listener
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = ({ editor }: { editor: Editor }) => {
      const noteId = activeNoteIdRef.current;
      if (!noteId) return;

      // Debounce save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      const timeout = window.setTimeout(async () => {
        saveTimeoutRef.current = null;
        isSavingRef.current = true;
        try {
          const jsonContent = editor.getJSON();
          const markdownContent = jsonToMarkdown(jsonContent);
          logger.debug('Autosave JSON->Markdown result:', markdownContent.substring(0, 500));
          // Use silent=true to save without triggering store update/re-render
          await updateNote(noteId, { content: markdownContent }, true);
        } catch (error) {
          logger.error('Autosave failed:', error);
        } finally {
          isSavingRef.current = false;
        }
      }, 1000);

      saveTimeoutRef.current = timeout;
    };

    editor.on('update', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, updateNote]);

  // Debounced content save
  const saveContent = useCallback(
    (content: string) => {
      const noteId = activeNoteIdRef.current;
      if (!noteId) return;

      // Debounce save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      const timeout = window.setTimeout(async () => {
        saveTimeoutRef.current = null;
        isSavingRef.current = true;
        try {
          // Use silent=true to save without triggering store update/re-render
          const result = await updateNote(noteId, { content }, true);
          if (!result) {
            logger.error('Autosave failed: updateNote returned falsy result');
          }
        } catch (error) {
          logger.error('Autosave failed:', error);
        } finally {
          isSavingRef.current = false;
        }
      }, 1000);

      saveTimeoutRef.current = timeout;
    },
    [updateNote],
  );

  // Immediate title save (shorter debounce for titles)
  const saveTitle = useCallback(
    async (title: string) => {
      if (!activeNoteId) return;

      // Clear any pending content save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Save title immediately (shorter debounce for titles)
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
    saveContent,
    saveTitle,
  };
}
