/**
 * Search IPC Handlers
 *
 * Uses services for business logic, not repositories directly.
 * Pattern: IPC Handler → Service → Repository → Database
 */

import { SEARCH_CHANNELS } from '@shared/constants/ipcChannels';
import { getRepositories } from '../../repositories';
import { getSearchService } from '../../services/SearchService';
import { registerHandler } from '../utils';
import { logger } from '../../utils/logger';

/**
 * Register all search handlers
 */
export function registerSearchHandlers() {
  const repos = getRepositories();

  // search:fullText - uses SearchService
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

      // Use SearchService for full-text search
      const searchService = getSearchService();
      let searchResults = await searchService.searchFullText(request.query, request.limit || 50);

      // Filter by notebook if specified
      if (request.notebookId) {
        searchResults = searchResults.filter((r) => r.note.notebookId === request.notebookId);
      }

      // Filter by tags if specified - use bulk loading instead of N+1
      if (request.tagIds && request.tagIds.length > 0) {
        const noteIds = searchResults.map((r) => r.note.id);
        const tagsMap = await repos.tag.getTagsForNotes(noteIds);
        const requestedTagIds = new Set(request.tagIds);

        searchResults = searchResults.filter((r) => {
          const noteTags = tagsMap.get(r.note.id) || [];
          const noteTagIds = noteTags.map((t) => t.id);
          return noteTagIds.some((id) => requestedTagIds.has(id));
        });
      }

      const queryTime = Date.now() - startTime;
      logger.info(`[IPC] search:fullText "${request.query}" → ${searchResults.length} results (${queryTime}ms)`);

      return {
        results: searchResults.map((r) => ({
          ...r.note,
          relevance: 1,
          title_highlight: r.note.title,
          matchType: r.matchType,
        })),
        total: searchResults.length,
        query_time_ms: queryTime,
      };
    },
  );

  // search:semantic - uses SearchService
  registerHandler(
    SEARCH_CHANNELS.SEMANTIC,
    async (
      event,
      request: { query: string; threshold?: number; limit?: number; notebookId?: string },
    ) => {
      const startTime = Date.now();
      const searchService = getSearchService();

      // Use semantic search from TopicService via SearchService
      const results = await searchService.semanticSearch(request.query, request.limit || 20);
      const queryTime = Date.now() - startTime;

      logger.info(`[IPC] search:semantic "${request.query}" → ${results.length} results (${queryTime}ms)`);

      return {
        results: results.map((r) => ({
          noteId: r.noteId,
          title: r.title,
          similarity: 1 - r.distance, // Convert distance to similarity
        })),
        total: results.length,
        query_time_ms: queryTime,
      };
    },
  );

  // search:hybrid - uses SearchService (combines FTS + semantic)
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
      const searchService = getSearchService();

      // Use full-text search via SearchService
      const ftsResults = await searchService.searchFullText(request.query, request.limit || 50);

      const queryTime = Date.now() - startTime;
      logger.info(`[IPC] search:hybrid "${request.query}" → ${ftsResults.length} results (${queryTime}ms)`);

      return {
        results: ftsResults.map((r) => ({
          ...r.note,
          score: 1,
          search_type: 'fts' as const,
        })),
        total: ftsResults.length,
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
