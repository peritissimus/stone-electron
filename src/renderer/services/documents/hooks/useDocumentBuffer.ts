/**
 * Document Buffer Hook - Manages in-memory document buffers
 *
 * Provides content from buffer if available, otherwise loads from file.
 * Handles saving dirty buffers to disk.
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  getEditorMarkdown,
  setEditorMarkdown,
  subscribeToEditorUpdates,
} from '@renderer/features/notes/editor/document';
import type { RichTextEditor } from '@renderer/features/notes/editor/types';
import { useDocumentBufferStore } from '@renderer/services/documents/model/documentBufferStore';
import type { CursorPosition } from '@renderer/services/documents/model/documentBufferStore';
export type { CursorPosition };
import { useNoteAPI } from '@renderer/features/notes/commands/useNoteAPI';
import { useInvalidation } from '@renderer/services/invalidation/hooks/useInvalidation';
import { logger } from '@renderer/services/telemetry/logger';
import { deleteDraft } from '@renderer/services/documents/lib/draftStorage';
import { noteAPI } from '@renderer/api';
import { useNoteStore } from '@renderer/features/notes/model/noteStore';

interface UseDocumentBufferOptions {
  noteId: string | null;
  editor: RichTextEditor | null;
}

interface UseDocumentBufferResult {
  isDirty: boolean;
  isLoading: boolean;
  save: () => Promise<boolean>;
  saveAll: () => Promise<void>;
  replaceContent: (markdown: string, options?: { dirty?: boolean }) => void;
}

// Track loading state outside of store to avoid re-renders
const loadingNotes = new Set<string>();

export function useDocumentBuffer({
  noteId,
  editor,
}: UseDocumentBufferOptions): UseDocumentBufferResult {
  const { updateNote } = useNoteAPI();
  const getBuffer = useDocumentBufferStore((state) => state.getBuffer);
  const setBuffer = useDocumentBufferStore((state) => state.setBuffer);
  const updateBuffer = useDocumentBufferStore((state) => state.updateBuffer);
  const markClean = useDocumentBufferStore((state) => state.markClean);
  const isDirty = useDocumentBufferStore((state) => state.isDirty);
  const getDirtyBuffers = useDocumentBufferStore((state) => state.getDirtyBuffers);

  const isLoadingRef = useRef(false);
  const suppressEditorUpdateRef = useRef(false);

  const hydrateEditor = useCallback(
    (markdown: string) => {
      if (!editor) return;
      suppressEditorUpdateRef.current = true;
      try {
        setEditorMarkdown(editor, markdown);
      } finally {
        setTimeout(() => {
          suppressEditorUpdateRef.current = false;
        }, 0);
      }
    },
    [editor],
  );

  // Load content into buffer and editor when note changes
  useEffect(() => {
    if (!noteId || !editor) return;

    const loadContent = async () => {
      // Check if already in buffer
      const existingBuffer = getBuffer(noteId);
      if (existingBuffer) {
        logger.debug('[useDocumentBuffer] Loading from buffer:', noteId);
        hydrateEditor(existingBuffer.content);
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
          hydrateEditor(response.data.content);
          setBuffer(noteId, response.data.content);
        } else {
          hydrateEditor('');
          setBuffer(noteId, '');
        }
      } catch (error) {
        logger.error('[useDocumentBuffer] Failed to load content:', error);
        hydrateEditor('');
        setBuffer(noteId, '');
      } finally {
        loadingNotes.delete(noteId);
        isLoadingRef.current = false;
      }
    };

    loadContent();
  }, [noteId, editor, getBuffer, setBuffer, hydrateEditor]);

  // Listen for editor updates and update buffer
  useEffect(() => {
    if (!editor || !noteId) return;

    const handleUpdate = () => {
      if (suppressEditorUpdateRef.current) return;

      try {
        updateBuffer(noteId, getEditorMarkdown(editor));
      } catch (error) {
        logger.error('[useDocumentBuffer] Failed to update buffer:', error);
      }
    };

    return subscribeToEditorUpdates(editor, handleUpdate);
  }, [editor, noteId, updateBuffer]);

  const replaceContent = useCallback(
    (markdown: string, options: { dirty?: boolean } = {}) => {
      if (!noteId) return;
      if (options.dirty) {
        updateBuffer(noteId, markdown);
      } else {
        setBuffer(noteId, markdown);
      }
    },
    [noteId, setBuffer, updateBuffer],
  );

  // Reload content from file when external update detected
  const reloadFromFile = useCallback(async () => {
    if (!noteId || !editor) return;
    if (loadingNotes.has(noteId)) return;
    if (useDocumentBufferStore.getState().isDirty(noteId)) {
      logger.debug('[useDocumentBuffer] Ignoring external reload for dirty buffer:', noteId);
      return;
    }

    logger.info('[useDocumentBuffer] External update detected, reloading:', noteId);
    loadingNotes.add(noteId);
    try {
      const response = await noteAPI.getContent(noteId);
      // The user may have started typing while the read was in flight. Never
      // replace that newer local buffer with an older disk snapshot.
      if (useDocumentBufferStore.getState().isDirty(noteId)) return;
      if (response.success && response.data) {
        hydrateEditor(response.data.content);
        setBuffer(noteId, response.data.content);
        logger.info('[useDocumentBuffer] Reloaded content from external update');
      }
    } catch (error) {
      logger.error('[useDocumentBuffer] Failed to reload after external update:', error);
    } finally {
      loadingNotes.delete(noteId);
    }
  }, [noteId, editor, setBuffer, hydrateEditor]);

  useInvalidation({
    sources: ['note', 'file'],
    actions: ['updated', 'changed'],
    debounceMs: 100,
    filter: (event) => {
      if (!noteId) return false;
      if (event.source === 'note') return event.noteId === noteId;
      if (event.source === 'file') {
        const notes = useNoteStore.getState().notes;
        const currentNote = notes.find((n) => n.id === noteId);
        return Boolean(currentNote?.filePath && currentNote.filePath.endsWith(event.path));
      }
      return false;
    },
    guard: () => Boolean(noteId && !useDocumentBufferStore.getState().isDirty(noteId)),
    invalidate: reloadFromFile,
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
      const markdown = buffer.content;
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
        const markdown = buffer.content;
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
    replaceContent,
  };
}

/**
 * Hook for autosaving dirty buffers on blur, note switch, and app close.
 * No periodic autosave - saves only on explicit triggers to avoid
 * unnecessary writes while user is actively editing.
 */
export function useDocumentAutosave() {
  const getDirtyBuffers = useDocumentBufferStore((state) => state.getDirtyBuffers);
  const markClean = useDocumentBufferStore((state) => state.markClean);
  const { updateNote } = useNoteAPI();

  const saveAllDirty = useCallback(async () => {
    const dirtyBuffers = getDirtyBuffers();
    if (dirtyBuffers.length === 0) return;

    logger.info('[useDocumentAutosave] Saving dirty buffers:', dirtyBuffers.length);

    for (const buffer of dirtyBuffers) {
      try {
        const markdown = buffer.content;
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
  const saveNote = useCallback(
    async (noteId: string) => {
      const buffer = useDocumentBufferStore.getState().getBuffer(noteId);
      if (!buffer || !buffer.isDirty) return;

      logger.debug('[useDocumentAutosave] Saving note on switch:', noteId);
      try {
        const markdown = buffer.content;
        const result = await updateNote(noteId, { content: markdown }, false);
        if (result) {
          markClean(noteId);
          deleteDraft(noteId);
        }
      } catch (error) {
        logger.error('[useDocumentAutosave] Failed to save on switch:', noteId, error);
      }
    },
    [updateNote, markClean],
  );

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
          const markdown = buffer.content;
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
