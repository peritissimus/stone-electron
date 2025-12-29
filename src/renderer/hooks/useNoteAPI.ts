/**
 * Note API Hook - React hooks for note operations
 */

import { useCallback, useRef } from 'react';
import { useNoteStore } from '@renderer/stores/noteStore';
import { Note, NoteVersion } from '@shared/types';
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels';
import { logger } from '@renderer/utils/logger';

// Module-level deduplication for loadNotes calls
let pendingLoadNotes: Promise<void> | null = null;
let lastLoadParams: string | null = null;

export function useNoteAPI() {
  const setNotes = useNoteStore((state) => state.setNotes);
  const addNote = useNoteStore((state) => state.addNote);
  const updateNote = useNoteStore((state) => state.updateNote);
  const deleteNote = useNoteStore((state) => state.deleteNote);
  const setLoading = useNoteStore((state) => state.setLoading);
  const setError = useNoteStore((state) => state.setError);

  const loadNotes = useCallback(
    async (filters?: {
      notebookId?: string;
      folderPath?: string;
      tagIds?: string[];
      isFavorite?: boolean;
      isPinned?: boolean;
      isArchived?: boolean;
    }) => {
      const params = filters || {};
      const paramsKey = JSON.stringify(params);

      // Deduplicate: if same request is already pending, reuse it
      if (pendingLoadNotes && lastLoadParams === paramsKey) {
        logger.info('[useNoteAPI.loadNotes] Deduplicating request, reusing pending call');
        return pendingLoadNotes;
      }

      setLoading(true);
      setError(null);

      const doLoad = async () => {
        try {
          logger.info('[useNoteAPI.loadNotes] invoking with params', params);
          const response = await window.electron.invoke<{ notes: Note[] }>(
            NOTE_CHANNELS.GET_ALL,
            params,
          );
          if (response.success && response.data) {
            const count = Array.isArray((response.data as any).notes)
              ? (response.data as any).notes.length
              : 0;
            logger.info('[useNoteAPI.loadNotes] loaded', count, 'notes');
            setNotes(response.data.notes);
          } else {
            setError(response.error?.message || 'Failed to load notes');
          }
        } catch (error) {
          logger.error('[useNoteAPI.loadNotes] error', error);
          setError(error instanceof Error ? error.message : 'Failed to load notes');
        } finally {
          setLoading(false);
          pendingLoadNotes = null;
          lastLoadParams = null;
        }
      };

      lastLoadParams = paramsKey;
      pendingLoadNotes = doLoad();
      return pendingLoadNotes;
    },
    [setNotes, setLoading, setError],
  );

  const createNote = useCallback(
    async (data: { title: string; content: string; folderPath?: string }) => {
      logger.info('[useNoteAPI.createNote] Called with:', {
        title: data.title,
        folderPath: data.folderPath,
        contentLength: data.content?.length || 0,
      });
      setLoading(true);
      setError(null);
      try {
        const response = await window.electron.invoke<Note>(NOTE_CHANNELS.CREATE, data);
        logger.info('[useNoteAPI.createNote] Response:', {
          success: response.success,
          noteId: response.data?.id,
          noteTitle: response.data?.title,
        });
        if (response.success && response.data) {
          addNote(response.data);
          return response.data;
        } else {
          setError(response.error?.message || 'Failed to create note');
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
        const response = await window.electron.invoke<Note>(NOTE_CHANNELS.UPDATE, { id, ...data });
        if (response.success && response.data) {
          // Only update store if not silent (silent = autosave without re-render)
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
        logger.info('[useNoteAPI.deleteNote] Invoking IPC...');
        const response = await window.electron.invoke(NOTE_CHANNELS.DELETE, { id, permanent });
        logger.info('[useNoteAPI.deleteNote] IPC response:', response);
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

  const getForwardLinks = useCallback(async (noteId: string) => {
    try {
      const response = await window.electron.invoke<{ forwardLinks: Note[] }>(
        NOTE_CHANNELS.GET_FORWARD_LINKS,
        {
          noteId: noteId,
        },
      );
      if (response.success && response.data) {
        return response.data.forwardLinks;
      }
      return [];
    } catch (error) {
      logger.error('Failed to get forward links:', error);
      return [];
    }
  }, []);

  const getGraphData = useCallback(async () => {
    try {
      const response = await window.electron.invoke<{
        nodes: { id: string; name: string; val: number }[];
        links: { source: string; target: string }[];
      }>(NOTE_CHANNELS.GET_GRAPH_DATA);
      if (response.success && response.data) {
        return response.data;
      }
      return { nodes: [], links: [] };
    } catch (error) {
      logger.error('Failed to get graph data:', error);
      return { nodes: [], links: [] };
    }
  }, []);

  const moveNote = useCallback(
    async (id: string, folderPath: string | null) => {
      logger.info('[useNoteAPI.moveNote] Moving note', { id, folderPath });
      setError(null);
      try {
        const response = await window.electron.invoke<Note>(NOTE_CHANNELS.MOVE, {
          id,
          folderPath,
        });
        if (response.success && response.data) {
          logger.info('[useNoteAPI.moveNote] Note moved successfully', {
            id,
            newFolderPath: folderPath,
            updatedNote: response.data
          });
          updateNote(response.data);
          return response.data;
        } else {
          logger.error('[useNoteAPI.moveNote] Failed to move note', {
            id,
            folderPath,
            error: response.error
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

  const exportHtml = useCallback(async (id: string, content: string, title: string) => {
    try {
      const response = await window.electron.invoke<{ success: boolean; filePath?: string; canceled?: boolean }>(
        NOTE_CHANNELS.EXPORT_HTML,
        { id, content, title },
      );
      if (response.success && response.data?.success) {
        logger.info('[useNoteAPI.exportHtml] Exported HTML', { filePath: response.data.filePath });
        return response.data;
      }
      return response.data || { success: false };
    } catch (error) {
      logger.error('[useNoteAPI.exportHtml] Error:', error);
      return { success: false };
    }
  }, []);

  const exportPdf = useCallback(async (id: string, content: string, title: string) => {
    try {
      const response = await window.electron.invoke<{ success: boolean; filePath?: string; canceled?: boolean }>(
        NOTE_CHANNELS.EXPORT_PDF,
        { id, content, title },
      );
      if (response.success && response.data?.success) {
        logger.info('[useNoteAPI.exportPdf] Exported PDF', { filePath: response.data.filePath });
        return response.data;
      }
      return response.data || { success: false };
    } catch (error) {
      logger.error('[useNoteAPI.exportPdf] Error:', error);
      return { success: false };
    }
  }, []);

  const exportMarkdown = useCallback(async (id: string, title: string) => {
    try {
      const response = await window.electron.invoke<{ success: boolean; filePath?: string; canceled?: boolean }>(
        NOTE_CHANNELS.EXPORT_MARKDOWN,
        { id, title },
      );
      if (response.success && response.data?.success) {
        logger.info('[useNoteAPI.exportMarkdown] Exported Markdown', { filePath: response.data.filePath });
        return response.data;
      }
      return response.data || { success: false };
    } catch (error) {
      logger.error('[useNoteAPI.exportMarkdown] Error:', error);
      return { success: false };
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
    getForwardLinks,
    getGraphData,
    moveNote,
    exportHtml,
    exportPdf,
    exportMarkdown,
  };
}
