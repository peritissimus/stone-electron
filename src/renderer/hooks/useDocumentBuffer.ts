/**
 * Document Buffer Hook - Manages in-memory document buffers
 *
 * Provides content from buffer if available, otherwise loads from file.
 * Handles saving dirty buffers to disk.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { RichTextEditor } from '@renderer/editor';
import { useDocumentBufferStore } from '@renderer/stores/documentBufferStore';
import type { CursorPosition } from '@renderer/stores/documentBufferStore';
export type { CursorPosition };
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useNoteEvents } from '@renderer/hooks/useNoteEvents';
import { useFileEvents } from '@renderer/hooks/useFileEvents';
import { serializeMarkdown } from '@renderer/lib/markdownSerializer';
import { parseMarkdown } from '@renderer/lib/markdownParser';
import { logger } from '@renderer/lib/logger';
import { deleteDraft } from '@renderer/lib/draftStorage';
import { noteAPI } from '@renderer/api';
import { useNoteStore } from '@renderer/stores/noteStore';

interface UseDocumentBufferOptions {
  noteId: string | null;
  editor: RichTextEditor | null;
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
  const { getBuffer, setBuffer, updateBuffer, markClean, isDirty, getDirtyBuffers, hasBuffer } =
    useDocumentBufferStore();

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
        const response = await noteAPI.getContent(noteId);

        if (response.success && response.data) {
          const jsonContent = parseMarkdown(response.data.content);
          editor.commands.setContent(jsonContent);
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

  // Debounce reload to prevent double-triggering from NOTE_UPDATED + FILE_CHANGED
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reload content from file when external update detected
  const reloadFromFile = useCallback(() => {
    if (!noteId || !editor) return;
    if (loadingNotes.has(noteId)) return;

    // Debounce: cancel pending reload and schedule new one
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
    }

    reloadTimerRef.current = setTimeout(async () => {
      if (loadingNotes.has(noteId)) return;

      logger.info('[useDocumentBuffer] External update detected, reloading:', noteId);

      const { removeBuffer } = useDocumentBufferStore.getState();
      removeBuffer(noteId);

      loadingNotes.add(noteId);
      try {
        const response = await noteAPI.getContent(noteId);
        if (response.success && response.data) {
          const jsonContent = parseMarkdown(response.data.content);
          editor.commands.setContent(jsonContent);
          setBuffer(noteId, jsonContent);
          logger.info('[useDocumentBuffer] Reloaded content from external update');
        }
      } catch (error) {
        logger.error('[useDocumentBuffer] Failed to reload after external update:', error);
      } finally {
        loadingNotes.delete(noteId);
      }
    }, 100); // 100ms debounce
  }, [noteId, editor, setBuffer]);

  // Cleanup reload timer on unmount
  useEffect(() => {
    return () => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
      }
    };
  }, []);

  // Listen for NOTE_UPDATED events (e.g., from quick capture)
  useNoteEvents({
    onUpdated: useCallback(
      (payload: unknown) => {
        const data = payload as { id?: string };
        if (data?.id === noteId) {
          reloadFromFile();
        }
      },
      [noteId, reloadFromFile],
    ),
  });

  // Listen for FILE_CHANGED events (external file modifications)
  useFileEvents({
    onChanged: useCallback(
      (payload: unknown) => {
        if (!noteId) return;
        const data = payload as { workspaceId?: string; path?: string };
        // Get current note's file path and check if it matches
        const notes = useNoteStore.getState().notes;
        const currentNote = notes.find((n) => n.id === noteId);
        if (currentNote?.filePath && data?.path && currentNote.filePath.endsWith(data.path)) {
          reloadFromFile();
        }
      },
      [noteId, reloadFromFile],
    ),
  });

  // Save current note to file
  const save = useCallback(async (): Promise<boolean> => {
    if (!noteId || !editor) return false;

    const buffer = getBuffer(noteId);
    if (!buffer || !buffer.isDirty) {
      logger.debug('[useDocumentBuffer] Nothing to save (not dirty):', noteId);
      return true;
    }

    try {
      const markdown = serializeMarkdown(buffer.content as any);
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
        const markdown = serializeMarkdown(buffer.content as any);
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
 * Hook for autosaving dirty buffers on blur, note switch, and app close.
 * No periodic autosave - saves only on explicit triggers to avoid
 * unnecessary writes while user is actively editing.
 */
export function useDocumentAutosave() {
  const { getDirtyBuffers, markClean } = useDocumentBufferStore();
  const { updateNote } = useNoteAPI();

  const saveAllDirty = useCallback(async () => {
    const dirtyBuffers = getDirtyBuffers();
    if (dirtyBuffers.length === 0) return;

    logger.info('[useDocumentAutosave] Saving dirty buffers:', dirtyBuffers.length);

    for (const buffer of dirtyBuffers) {
      try {
        const markdown = serializeMarkdown(buffer.content as any);
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

  // Save a specific note (used when switching notes)
  const saveNote = useCallback(async (noteId: string) => {
    const buffer = useDocumentBufferStore.getState().getBuffer(noteId);
    if (!buffer || !buffer.isDirty) return;

    logger.debug('[useDocumentAutosave] Saving note on switch:', noteId);
    try {
      const markdown = serializeMarkdown(buffer.content as any);
      const result = await updateNote(noteId, { content: markdown }, false);
      if (result) {
        markClean(noteId);
        deleteDraft(noteId);
      }
    } catch (error) {
      logger.error('[useDocumentAutosave] Failed to save on switch:', noteId, error);
    }
  }, [updateNote, markClean]);

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
          const markdown = serializeMarkdown(buffer.content as any);
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

  return { saveAllDirty, saveNote };
}
