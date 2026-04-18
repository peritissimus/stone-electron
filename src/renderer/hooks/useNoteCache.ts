/**
 * Note Cache Service Hook - Provides cached access to notes for autocomplete
 */

import { useCallback, useRef } from 'react';
import { noteAPI } from '@renderer/api';
import type { Note } from '@shared/types';
import { logger } from '@renderer/utils/logger';

interface NoteCacheEntry {
  notes: Note[];
  timestamp: number;
}

const NOTES_CACHE_TTL_MS = 30000;

export function useNoteCache() {
  const cacheRef = useRef<NoteCacheEntry | null>(null);

  const invalidate = useCallback(() => {
    cacheRef.current = null;
  }, []);

  const fetchNotes = useCallback(async (): Promise<Note[]> => {
    try {
      const now = Date.now();

      if (!cacheRef.current || now - cacheRef.current.timestamp > NOTES_CACHE_TTL_MS) {
        const response = await noteAPI.getAll({ includeArchived: false });

        if (response.success && response.data) {
          cacheRef.current = {
            notes: response.data.notes || [],
            timestamp: now,
          };
        } else {
          logger.warn('Failed to fetch notes for cache');
          return [];
        }
      }

      return cacheRef.current.notes;
    } catch (error) {
      logger.error('Failed to fetch notes for cache:', error);
      return [];
    }
  }, []);

  const fetchNotesForAutocomplete = useCallback(
    async (query: string) => {
      try {
        const notes = await fetchNotes();
        const lowerQuery = query.toLowerCase();

        const filtered = query
          ? notes.filter((note) => note.title?.toLowerCase().includes(lowerQuery))
          : notes;

        const sorted = filtered.sort((a, b) => {
          const aTitle = (a.title || '').toLowerCase();
          const bTitle = (b.title || '').toLowerCase();
          const aStarts = aTitle.startsWith(lowerQuery);
          const bStarts = bTitle.startsWith(lowerQuery);

          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return aTitle.localeCompare(bTitle);
        });

        return sorted.slice(0, 10).map((note) => ({
          id: note.id,
          title: note.title || 'Untitled',
          filePath: note.filePath,
          note,
        }));
      } catch (error) {
        logger.error('Failed to fetch notes for autocomplete:', error);
        return [];
      }
    },
    [fetchNotes],
  );

  return {
    fetchNotes,
    fetchNotesForAutocomplete,
    invalidate,
  };
}
