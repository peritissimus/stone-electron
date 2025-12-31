/**
 * Search IPC Handlers
 */


import { SEARCH_CHANNELS } from '@shared/constants/ipcChannels';
import { getRepositories } from '../../repositories';
import { registerHandler } from '../utils';

/**
 * Register all search handlers
 */
export function registerSearchHandlers() {
  const repos = getRepositories();

  // search:fullText
  registerHandler(
    SEARCH_CHANNELS.FULL_TEXT,
    
      async (
        event,
        request: {
          query: string;
          notebookId?: string;
          tagIds?: string[];
          limit?: number;
          offset?: number;
        },
      ) => {
        const startTime = Date.now();

        let results = await repos.note.searchFullText(request.query, request.limit || 50);

        // Filter by notebook if specified
        if (request.notebookId) {
          results = results.filter((note) => note.notebookId === request.notebookId);
        }

        // Filter by tags if specified - use bulk loading instead of N+1
        if (request.tagIds && request.tagIds.length > 0) {
          const noteIds = results.map(note => note.id);
          const tagsMap = await repos.tag.getTagsForNotes(noteIds);

          results = results.filter(note => {
            const noteTags = tagsMap.get(note.id) || [];
            return request.tagIds!.some(tagId => noteTags.some(t => t.id === tagId));
          });
        }

        const queryTime = Date.now() - startTime;

        return {
          results: results.map((note) => ({
            ...note,
            relevance: 1.0, // FTS5 ranking could be added here
            title_highlight: note.title,
          })),
          total: results.length,
          query_time_ms: queryTime,
        };
      },
  );

  // search:semantic (placeholder - will implement with vector DB)
  registerHandler(
    SEARCH_CHANNELS.SEMANTIC,
    
      async (
        event,
        request: { query: string; threshold?: number; limit?: number; notebookId?: string },
      ) => {
        // TODO: Implement vector search with Vectra
        // For now, fallback to full-text search
        const startTime = Date.now();
        const results = await repos.note.searchFullText(request.query, request.limit || 20);
        const queryTime = Date.now() - startTime;

        return {
          results: results.map((note) => ({
            ...note,
            similarity: 0.8, // Placeholder similarity score
          })),
          total: results.length,
          query_time_ms: queryTime,
        };
      },
  );

  // search:hybrid
  registerHandler(
    SEARCH_CHANNELS.HYBRID,
    
      async (
        event,
        request: {
          query: string;
          weights?: { fts: number; semantic: number };
          limit?: number;
          notebookId?: string;
          tagIds?: string[];
        },
      ) => {
        const startTime = Date.now();

        // For now, just use FTS (will combine with vector search later)
        const results = await repos.note.searchFullText(request.query, request.limit || 50);

        const queryTime = Date.now() - startTime;

        return {
          results: results.map((note) => ({
            ...note,
            score: 1.0,
            search_type: 'fts' as const,
          })),
          total: results.length,
          query_time_ms: queryTime,
        };
      },
  );

  // search:byTag
  registerHandler(
    SEARCH_CHANNELS.BY_TAG,
    
      async (
        event,
        request: { tagIds: string[]; match_all?: boolean; limit?: number; offset?: number },
      ) => {
        let notes;

        if (request.match_all) {
          // AND logic - notes must have all tags
          notes = await repos.note.findByTags(request.tagIds);
        } else {
          // OR logic - notes with any of the tags (single query instead of N+1)
          notes = await repos.note.findByTagsAny(request.tagIds);
        }

        return {
          notes: notes.slice(
            request.offset || 0,
            (request.offset || 0) + (request.limit || notes.length),
          ),
          total: notes.length,
        };
      },
  );

  // search:byDateRange
  registerHandler(
    SEARCH_CHANNELS.BY_DATE_RANGE,
    
      async (
        event,
        request: {
          start_date: number;
          end_date: number;
          field?: 'created' | 'updated';
          limit?: number;
        },
      ) => {
        const field = request.field === 'created' ? 'createdAt' : 'updatedAt';
        const notes = await repos.note.findByDateRange(
          new Date(request.start_date),
          new Date(request.end_date),
          field as any,
        );

        return {
          notes: notes.slice(0, request.limit || notes.length),
          total: notes.length,
        };
      },
  );
}
