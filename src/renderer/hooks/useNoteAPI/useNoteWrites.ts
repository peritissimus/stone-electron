import { useCallback } from 'react';
import { useNoteStore } from '@renderer/stores/noteStore';
import { logger } from '@renderer/lib/logger';
import { noteAPI } from '@renderer/api';

export function useNoteWrites() {
  const addNote = useNoteStore((state) => state.addNote);
  const updateNote = useNoteStore((state) => state.updateNote);
  const deleteNote = useNoteStore((state) => state.deleteNote);
  const setLoading = useNoteStore((state) => state.setLoading);
  const setError = useNoteStore((state) => state.setError);

  const getNoteById = useCallback((id: string) => {
    return useNoteStore.getState().notes.find((n) => n.id === id);
  }, []);

  const createNote = useCallback(
    async (data: { title: string; content?: string; folderPath?: string }) => {
      logger.info('[useNoteAPI.createNote] Called with:', {
        title: data.title,
        folderPath: data.folderPath,
        contentLength: data.content?.length || 0,
      });
      setLoading(true);
      setError(null);
      try {
        const response = await noteAPI.create({
          title: data.title,
          content: data.content,
          folderPath: data.folderPath,
        });
        logger.info('[useNoteAPI.createNote] Response:', {
          success: response.success,
          noteId: response.data?.id,
          noteTitle: response.data?.title,
          error: response.error,
        });
        if (response.success && response.data) {
          addNote(response.data);
          return response.data;
        } else {
          const errorMessage = response.error?.message || 'Failed to create note';
          logger.error('[useNoteAPI.createNote] Failed:', {
            errorMessage,
            errorCode: response.error?.code,
            errorDetails: response.error?.details,
          });
          setError(errorMessage);
          return null;
        }
      } catch (error) {
        logger.error('[useNoteAPI.createNote] Error:', error);
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
      silent = false,
    ) => {
      setError(null);
      try {
        const response = await noteAPI.update(
          id,
          {
            title: data.title,
            content: data.content,
            notebookId: data.notebookId,
          },
          silent,
        );
        if (response.success && response.data) {
          if (!silent) {
            updateNote(response.data);
          }
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
      logger.info('[useNoteAPI.deleteNote] Starting delete', { id, permanent });
      setError(null);
      try {
        logger.info('[useNoteAPI.deleteNote] Invoking API...');
        const response = await noteAPI.delete(id);
        logger.info('[useNoteAPI.deleteNote] API response:', response);
        if (response.success) {
          logger.info('[useNoteAPI.deleteNote] Removing from store...');
          deleteNote(id);
          logger.info('[useNoteAPI.deleteNote] Done');
          return true;
        } else {
          logger.error('[useNoteAPI.deleteNote] Failed:', response.error);
          setError(response.error?.message || 'Failed to delete note');
          return false;
        }
      } catch (error) {
        logger.error('[useNoteAPI.deleteNote] Exception:', error);
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
        const note = getNoteById(id);
        const response = await noteAPI.favorite(id, !note?.isFavorite);
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
    [updateNote, setError, getNoteById],
  );

  const togglePin = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const note = getNoteById(id);
        const response = await noteAPI.pin(id, !note?.isPinned);
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
    [updateNote, setError, getNoteById],
  );

  const toggleArchive = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const note = getNoteById(id);
        const response = await noteAPI.archive(id, !note?.isArchived);
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
    [updateNote, setError, getNoteById],
  );

  const restoreVersion = useCallback(
    async (noteId: string, versionId: string) => {
      setError(null);
      try {
        const response = await noteAPI.restoreVersion(noteId, versionId);
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

  const moveNote = useCallback(
    async (id: string, folderPath: string | null) => {
      logger.info('[useNoteAPI.moveNote] Moving note', { id, folderPath });
      setError(null);
      try {
        const response = await noteAPI.move(id, folderPath || '');
        if (response.success && response.data) {
          logger.info('[useNoteAPI.moveNote] Note moved successfully', {
            id,
            newFolderPath: folderPath,
            updatedNote: response.data,
          });
          updateNote(response.data);
          return response.data;
        } else {
          logger.error('[useNoteAPI.moveNote] Failed to move note', {
            id,
            folderPath,
            error: response.error,
          });
          setError(response.error?.message || 'Failed to move note');
          return null;
        }
      } catch (error) {
        logger.error('[useNoteAPI.moveNote] Exception while moving note', { error });
        setError(error instanceof Error ? error.message : 'Failed to move note');
        return null;
      }
    },
    [updateNote, setError],
  );

  const updateTaskState = useCallback(
    async (noteId: string, taskIndex: number, newState: string) => {
      setError(null);
      try {
        const response = await noteAPI.updateTaskState(noteId, taskIndex, newState);
        if (response.success) {
          logger.info('[useNoteAPI.updateTaskState] Task state updated', {
            noteId,
            taskIndex,
            newState,
          });
          return true;
        } else {
          setError(response.error?.message || 'Failed to update task state');
          return false;
        }
      } catch (error) {
        logger.error('[useNoteAPI.updateTaskState] Error:', error);
        setError(error instanceof Error ? error.message : 'Failed to update task state');
        return false;
      }
    },
    [setError],
  );

  return {
    createNote,
    updateNote: updateNoteContent,
    deleteNote: deleteNoteById,
    toggleFavorite,
    togglePin,
    toggleArchive,
    restoreVersion,
    moveNote,
    updateTaskState,
  };
}
