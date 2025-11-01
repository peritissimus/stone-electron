/**
 * Note API Hook - React hooks for note operations
 */

import { useCallback } from 'react';
import { useNoteStore } from '@renderer/stores/noteStore';
import { Note, NoteVersion } from '@shared/types';
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels';
import { logger } from '@renderer/utils/logger';

export function useNoteAPI() {
  const { setNotes, addNote, updateNote, deleteNote, setLoading, setError } = useNoteStore();

  const loadNotes = useCallback(
    async (filters?: {
      notebookId?: string;
      folderPath?: string;
      tagIds?: string[];
      isFavorite?: boolean;
      isPinned?: boolean;
      isArchived?: boolean;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const params = filters || {};
        logger.info('[useNoteAPI.loadNotes] invoking with params', params);
        const response = await window.electron.invoke<{ notes: Note[] }>(
          NOTE_CHANNELS.GET_ALL,
          params,
        );
        logger.info('[useNoteAPI.loadNotes] response', response);
        if (response.success && response.data) {
          const count = Array.isArray((response.data as any).notes)
            ? (response.data as any).notes.length
            : 0;
          logger.info('[useNoteAPI.loadNotes] setting notes length', count);
          setNotes(response.data.notes);
        } else {
          setError(response.error?.message || 'Failed to load notes');
        }
      } catch (error) {
        logger.error('[useNoteAPI.loadNotes] error', error);
        setError(error instanceof Error ? error.message : 'Failed to load notes');
      } finally {
        setLoading(false);
      }
    },
    [setNotes, setLoading, setError],
  );

  const createNote = useCallback(
    async (data: { title: string; content: string; folderPath?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const response = await window.electron.invoke<Note>(NOTE_CHANNELS.CREATE, data);
        if (response.success && response.data) {
          addNote(response.data);
          return response.data;
        } else {
          setError(response.error?.message || 'Failed to create note');
          return null;
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to create note');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [addNote, setLoading, setError],
  );

  const updateNoteContent = useCallback(
    async (
      id: string,
      data: { title?: string; content?: string; folderPath?: string; notebookId?: string },
    ) => {
      setError(null);
      try {
        const response = await window.electron.invoke<Note>(NOTE_CHANNELS.UPDATE, { id, ...data });
        if (response.success && response.data) {
          updateNote(response.data);
          return response.data;
        } else {
          setError(response.error?.message || 'Failed to update note');
          return null;
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to update note');
        return null;
      }
    },
    [updateNote, setError],
  );

  const deleteNoteById = useCallback(
    async (id: string, permanent = false) => {
      setError(null);
      try {
        const response = await window.electron.invoke(NOTE_CHANNELS.DELETE, { id, permanent });
        if (response.success) {
          deleteNote(id);
          return true;
        } else {
          setError(response.error?.message || 'Failed to delete note');
          return false;
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to delete note');
        return false;
      }
    },
    [deleteNote, setError],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const response = await window.electron.invoke<Note>(NOTE_CHANNELS.FAVORITE, { id });
        if (response.success && response.data) {
          updateNote(response.data);
          return response.data;
        } else {
          setError(response.error?.message || 'Failed to toggle favorite');
          return null;
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to toggle favorite');
        return null;
      }
    },
    [updateNote, setError],
  );

  const togglePin = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const response = await window.electron.invoke<Note>(NOTE_CHANNELS.PIN, { id });
        if (response.success && response.data) {
          updateNote(response.data);
          return response.data;
        } else {
          setError(response.error?.message || 'Failed to toggle pin');
          return null;
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to toggle pin');
        return null;
      }
    },
    [updateNote, setError],
  );

  const toggleArchive = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const response = await window.electron.invoke<Note>(NOTE_CHANNELS.ARCHIVE, { id });
        if (response.success && response.data) {
          updateNote(response.data);
          return response.data;
        } else {
          setError(response.error?.message || 'Failed to toggle archive');
          return null;
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to toggle archive');
        return null;
      }
    },
    [updateNote, setError],
  );

  const getVersions = useCallback(async (noteId: string) => {
    try {
      const response = await window.electron.invoke<{ versions: NoteVersion[] }>(
        NOTE_CHANNELS.GET_VERSIONS,
        { noteId: noteId },
      );
      if (response.success && response.data) {
        return response.data.versions;
      }
      return [];
    } catch (error) {
      logger.error('Failed to get versions:', error);
      return [];
    }
  }, []);

  const restoreVersion = useCallback(
    async (noteId: string, versionId: string) => {
      setError(null);
      try {
        const response = await window.electron.invoke<Note>(NOTE_CHANNELS.RESTORE_VERSION, {
          noteId: noteId,
          version_id: versionId,
        });
        if (response.success && response.data) {
          updateNote(response.data);
          return response.data;
        } else {
          setError(response.error?.message || 'Failed to restore version');
          return null;
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to restore version');
        return null;
      }
    },
    [updateNote, setError],
  );

  const loadNoteById = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const response = await window.electron.invoke<Note>(NOTE_CHANNELS.GET, { id });
        if (response.success && response.data) {
          updateNote(response.data);
          return response.data;
        } else {
          setError(response.error?.message || 'Failed to load note');
          return null;
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load note');
        return null;
      }
    },
    [updateNote, setError],
  );

  const getBacklinks = useCallback(async (noteId: string) => {
    try {
      const response = await window.electron.invoke<{ backlinks: Note[] }>(
        NOTE_CHANNELS.GET_BACKLINKS,
        {
          noteId: noteId,
        },
      );
      if (response.success && response.data) {
        return response.data.backlinks;
      }
      return [];
    } catch (error) {
      logger.error('Failed to get backlinks:', error);
      return [];
    }
  }, []);

  return {
    loadNotes,
    createNote,
    updateNote: updateNoteContent,
    deleteNote: deleteNoteById,
    toggleFavorite,
   togglePin,
   toggleArchive,
   getVersions,
   restoreVersion,
    loadNoteById,
    getBacklinks,
  };
}
