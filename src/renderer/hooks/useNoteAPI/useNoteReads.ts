import { useCallback } from 'react';
import { useNoteStore } from '@renderer/stores/noteStore';
import type { NoteVersion } from '@shared/types';
import { logger } from '@renderer/lib/logger';
import { noteAPI } from '@renderer/api';

let pendingLoadNotes: Promise<void> | null = null;
let lastLoadParams: string | null = null;

export function useNoteReads() {
  const setNotes = useNoteStore((state) => state.setNotes);
  const addNote = useNoteStore((state) => state.addNote);
  const updateNote = useNoteStore((state) => state.updateNote);
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

      if (pendingLoadNotes && lastLoadParams === paramsKey) {
        logger.info('[useNoteAPI.loadNotes] Deduplicating request, reusing pending call');
        return pendingLoadNotes;
      }

      setLoading(true);
      setError(null);

      const doLoad = async () => {
        try {
          logger.info('[useNoteAPI.loadNotes] invoking with params', params);
          const response = await noteAPI.getAll(params);
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

  const loadNoteById = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const response = await noteAPI.getById(id);
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

  const loadNoteByPath = useCallback(
    async (path: string) => {
      setError(null);
      try {
        const response = await noteAPI.getByPath(path);
        if (response.success && response.data) {
          addNote(response.data);
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
    [addNote, setError],
  );

  const getVersions = useCallback(async (noteId: string) => {
    try {
      const response = await noteAPI.getVersions(noteId);
      if (response.success && response.data) {
        return response.data.versions as NoteVersion[];
      }
      return [];
    } catch (error) {
      logger.error('Failed to get versions:', error);
      return [];
    }
  }, []);

  const getBacklinks = useCallback(async (noteId: string) => {
    try {
      const response = await noteAPI.getBacklinks(noteId);
      if (response.success && response.data) {
        return response.data.notes;
      }
      return [];
    } catch (error) {
      logger.error('Failed to get backlinks:', error);
      return [];
    }
  }, []);

  const getForwardLinks = useCallback(async (noteId: string) => {
    try {
      const response = await noteAPI.getForwardLinks(noteId);
      if (response.success && response.data) {
        return response.data.notes;
      }
      return [];
    } catch (error) {
      logger.error('Failed to get forward links:', error);
      return [];
    }
  }, []);

  const getGraphData = useCallback(async () => {
    try {
      const response = await noteAPI.getGraphData();
      logger.info('[useNoteAPI.getGraphData] Response:', response);
      if (response.success && response.data) {
        logger.info('[useNoteAPI.getGraphData] Returning data:', {
          nodes: response.data.nodes?.length,
          links: response.data.links?.length,
        });
        return {
          nodes: response.data.nodes || [],
          links: response.data.links || [],
        };
      }
      logger.warn('[useNoteAPI.getGraphData] No data in response');
      return { nodes: [], links: [] };
    } catch (error) {
      logger.error('[useNoteAPI.getGraphData] Failed:', error);
      return { nodes: [], links: [] };
    }
  }, []);

  const getAllTodos = useCallback(async () => {
    try {
      const response = await noteAPI.getAllTodos();
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch (error) {
      logger.error('[useNoteAPI.getAllTodos] Error:', error);
      return [];
    }
  }, []);

  return {
    loadNotes,
    loadNoteById,
    loadNoteByPath,
    getVersions,
    getBacklinks,
    getForwardLinks,
    getGraphData,
    getAllTodos,
  };
}
