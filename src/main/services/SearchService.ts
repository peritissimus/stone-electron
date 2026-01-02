/**
 * SearchService - Full-text and semantic search for notes
 *
 * Handles both traditional text search and vector-based semantic search.
 */

import { getRepositories } from '../repositories';
import { getNoteService } from './NoteService';
import { getTopicService } from './TopicService';
import { logger } from '../utils/logger';
import type { Note } from '@shared/types';

export interface SearchResult {
  note: Note;
  matchType: 'title' | 'content' | 'both';
}

export interface SemanticSearchResult {
  noteId: string;
  title: string;
  distance: number;
}

/**
 * SearchService handles all search operations
 */
class SearchService {
  // ==========================================================================
  // Full-Text Search
  // ==========================================================================

  /**
   * Search notes by text (title and content)
   */
  async searchFullText(query: string, limit: number = 50): Promise<SearchResult[]> {
    const repos = getRepositories();
    const noteService = getNoteService();

    const lowerQuery = query.toLowerCase();
    const matches: SearchResult[] = [];

    // Get all active notes
    const allNotes = await repos.note.findAll({
      where: { isDeleted: false },
      sort: { field: 'updatedAt', order: 'DESC' },
      limit: limit * 2, // Fetch more to allow for filtering
    });

    for (const note of allNotes) {
      if (matches.length >= limit) break;

      const titleMatch = note.title?.toLowerCase().includes(lowerQuery) ?? false;
      let contentMatch = false;

      // Check content if note has file backing
      if (note.filePath && note.workspaceId) {
        try {
          const content = await noteService.getContent(note.id);
          if (content) {
            contentMatch = content.toLowerCase().includes(lowerQuery);
          }
        } catch (error) {
          logger.debug(`[SearchService] Could not read content for note ${note.id}`);
        }
      }

      if (titleMatch || contentMatch) {
        matches.push({
          note,
          matchType: titleMatch && contentMatch ? 'both' : titleMatch ? 'title' : 'content',
        });
      }
    }

    return matches;
  }

  /**
   * Search notes by title only (faster)
   */
  async searchByTitle(query: string, limit: number = 20): Promise<Note[]> {
    const repos = getRepositories();
    const lowerQuery = query.toLowerCase();

    const allNotes = await repos.note.findAll({
      where: { isDeleted: false },
      sort: { field: 'updatedAt', order: 'DESC' },
    });

    return allNotes
      .filter((note) => note.title?.toLowerCase().includes(lowerQuery))
      .slice(0, limit);
  }

  // ==========================================================================
  // Semantic Search
  // ==========================================================================

  /**
   * Semantic search using embeddings
   */
  async semanticSearch(query: string, limit: number = 10): Promise<SemanticSearchResult[]> {
    try {
      const topicService = getTopicService();

      // Ensure embedding service is ready
      if (!topicService.isReady()) {
        await topicService.initialize();
      }

      return await topicService.semanticSearch(query, limit);
    } catch (error) {
      logger.error('[SearchService] Semantic search failed:', error);
      return [];
    }
  }

  /**
   * Find notes similar to a given note
   */
  async findSimilarNotes(noteId: string, limit: number = 5): Promise<SemanticSearchResult[]> {
    const repos = getRepositories();

    try {
      // Get the note's embedding
      const embedding = await repos.note.getEmbedding(noteId);
      if (!embedding) {
        logger.debug(`[SearchService] No embedding found for note ${noteId}`);
        return [];
      }

      // Find similar notes
      const results = await repos.note.findBySimilarity(embedding, limit + 1);

      // Filter out the source note
      return results
        .filter((r) => r.noteId !== noteId)
        .slice(0, limit);
    } catch (error) {
      logger.error(`[SearchService] Failed to find similar notes for ${noteId}:`, error);
      return [];
    }
  }
}

// Singleton instance
let instance: SearchService | null = null;

export function getSearchService(): SearchService {
  instance ??= new SearchService();
  return instance;
}
