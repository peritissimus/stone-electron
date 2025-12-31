/**
 * Document Buffer Hook - Manages in-memory document buffers
 *
 * Provides content from buffer if available, otherwise loads from file.
 * Handles saving dirty buffers to disk.
 */

import { useCallback, useEffect, useRef } from 'react';
import { Editor, JSONContent } from '@tiptap/react';
import { useDocumentBufferStore } from '@renderer/stores/documentBufferStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels';
import { jsonToMarkdown } from '@renderer/utils/jsonToMarkdown';
import { logger } from '@renderer/utils/logger';
import { deleteDraft } from '@renderer/utils/draftStorage';

interface UseDocumentBufferOptions {
  noteId: string | null;
  editor: Editor | null;
}

interface UseDocumentBufferResult {
  isDirty: boolean;
  isLoading: boolean;
  save: () => Promise<boolean>;
  saveAll: () => Promise<void>;
}

// Track loading state outside of store to avoid re-renders
const loadingNotes = new Set<string>();

export function useDocumentBuffer({
  noteId,
  editor,
}: UseDocumentBufferOptions): UseDocumentBufferResult {
  const { updateNote } = useNoteAPI();
  const {
    getBuffer,
    setBuffer,
    updateBuffer,
    markClean,
    isDirty,
    getDirtyBuffers,
    hasBuffer,
  } = useDocumentBufferStore();

  const isLoadingRef = useRef(false);

  // Load content into buffer and editor when note changes
  useEffect(() => {
    if (!noteId || !editor) return;

    const loadContent = async () => {
      // Check if already in buffer
      const existingBuffer = getBuffer(noteId);
      if (existingBuffer) {
        logger.debug('[useDocumentBuffer] Loading from buffer:', noteId);
        editor.commands.setContent(existingBuffer.content);
        return;
      }

      // Prevent duplicate loads
      if (loadingNotes.has(noteId)) return;
      loadingNotes.add(noteId);
      isLoadingRef.current = true;

      try {
        logger.debug('[useDocumentBuffer] Loading from file:', noteId);
        const response = await window.electron.invoke<{ content: string }>(
          NOTE_CHANNELS.GET_CONTENT,
          { id: noteId }
        );

        if (response.success && response.data) {
          const htmlContent = response.data.content;
          // Set content in editor
          editor.commands.setContent(htmlContent);
          // Cache the parsed JSON in buffer
          const jsonContent = editor.getJSON();
          setBuffer(noteId, jsonContent);
        } else {
          editor.commands.setContent('');
          setBuffer(noteId, { type: 'doc', content: [] });
        }
      } catch (error) {
        logger.error('[useDocumentBuffer] Failed to load content:', error);
        editor.commands.setContent('');
      } finally {
        loadingNotes.delete(noteId);
        isLoadingRef.current = false;
      }
    };

    loadContent();
  }, [noteId, editor, getBuffer, setBuffer, hasBuffer]);

  // Listen for editor updates and update buffer
  useEffect(() => {
    if (!editor || !noteId) return;

    const handleUpdate = () => {
      try {
        const content = editor.getJSON();
        updateBuffer(noteId, content);
      } catch (error) {
        logger.error('[useDocumentBuffer] Failed to update buffer:', error);
      }
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, noteId, updateBuffer]);

  // Save current note to file
  const save = useCallback(async (): Promise<boolean> => {
    if (!noteId || !editor) return false;

    const buffer = getBuffer(noteId);
    if (!buffer || !buffer.isDirty) {
      logger.debug('[useDocumentBuffer] Nothing to save (not dirty):', noteId);
      return true;
    }

    try {
      const markdown = jsonToMarkdown(buffer.content as any);
      const result = await updateNote(noteId, { content: markdown }, false);

      if (result) {
        markClean(noteId);
        deleteDraft(noteId);
        logger.info('[useDocumentBuffer] Saved:', noteId);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('[useDocumentBuffer] Save failed:', error);
      return false;
    }
  }, [noteId, editor, getBuffer, updateNote, markClean]);

  // Save all dirty buffers
  const saveAll = useCallback(async () => {
    const dirtyBuffers = getDirtyBuffers();
    logger.info('[useDocumentBuffer] Saving all dirty buffers:', dirtyBuffers.length);

    for (const buffer of dirtyBuffers) {
      try {
        const markdown = jsonToMarkdown(buffer.content as any);
        const result = await updateNote(buffer.noteId, { content: markdown }, false);
        if (result) {
          markClean(buffer.noteId);
          deleteDraft(buffer.noteId);
        }
      } catch (error) {
        logger.error('[useDocumentBuffer] Failed to save buffer:', buffer.noteId, error);
      }
    }
  }, [getDirtyBuffers, updateNote, markClean]);

  return {
    isDirty: noteId ? isDirty(noteId) : false,
    isLoading: isLoadingRef.current,
    save,
    saveAll,
  };
}

/**
 * Hook for autosaving dirty buffers periodically and on blur/close
 */
export function useDocumentAutosave(intervalMs: number = 30000) {
  const { getDirtyBuffers, markClean } = useDocumentBufferStore();
  const { updateNote } = useNoteAPI();

  const saveAllDirty = useCallback(async () => {
    const dirtyBuffers = getDirtyBuffers();
    if (dirtyBuffers.length === 0) return;

    logger.info('[useDocumentAutosave] Autosaving dirty buffers:', dirtyBuffers.length);

    for (const buffer of dirtyBuffers) {
      try {
        const markdown = jsonToMarkdown(buffer.content as any);
        const result = await updateNote(buffer.noteId, { content: markdown }, false);
        if (result) {
          markClean(buffer.noteId);
          deleteDraft(buffer.noteId);
          logger.debug('[useDocumentAutosave] Saved:', buffer.noteId);
        }
      } catch (error) {
        logger.error('[useDocumentAutosave] Failed to save:', buffer.noteId, error);
      }
    }
  }, [getDirtyBuffers, updateNote, markClean]);

  // Periodic autosave
  useEffect(() => {
    const interval = setInterval(saveAllDirty, intervalMs);
    return () => clearInterval(interval);
  }, [saveAllDirty, intervalMs]);

  // Save on window blur
  useEffect(() => {
    const handleBlur = () => {
      logger.debug('[useDocumentAutosave] Window blur - saving');
      saveAllDirty();
    };

    const handleBeforeUnload = () => {
      logger.debug('[useDocumentAutosave] Before unload - saving');
      // Use sync version for beforeunload
      const dirtyBuffers = getDirtyBuffers();
      for (const buffer of dirtyBuffers) {
        try {
          const markdown = jsonToMarkdown(buffer.content as any);
          // Fire and forget - can't await in beforeunload
          updateNote(buffer.noteId, { content: markdown }, false);
        } catch {
          // Ignore errors on unload
        }
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [saveAllDirty, getDirtyBuffers, updateNote]);

  return { saveAllDirty };
}
