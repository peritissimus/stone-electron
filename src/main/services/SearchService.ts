/**
 * SearchService - Full-text and semantic search for notes
 *
 * Handles both traditional text search and vector-based semantic search.
 */

import { logger } from '../utils/logger';
import type { Note } from '@shared/types';
import type { NoteRepository } from '../repositories/NoteRepository';
import type { NoteService } from './NoteService';
import type { TopicService } from './TopicService';

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
 * Dependencies for SearchService
 */
export interface SearchServiceDeps {
  noteRepository: NoteRepository;
  noteService: NoteService;
  topicService: TopicService;
}

/**
 * SearchService handles all search operations
 */
export class SearchService {
  constructor(private readonly deps: SearchServiceDeps) {}
  // ==========================================================================
  // Full-Text Search
  // ==========================================================================

  /**
   * Search notes by text (title and content)
   */
  async searchFullText(query: string, limit: number = 50): Promise<SearchResult[]> {
    const lowerQuery = query.toLowerCase();
    const matches: SearchResult[] = [];

    // Get all active notes
    const allNotes = await this.deps.noteRepository.findAll({
      where: { isDeleted: false },
      sort: { field: 'updatedAt', order: 'DESC' },
      limit: limit * 2, // Fetch more to allow for filtering
    });

    for (const note of allNotes) {
      if (matches.length >= limit) break;

      const matchResult = await this.evaluateNoteMatch(note, lowerQuery);
      if (matchResult) {
        matches.push(matchResult);
      }
    }

    return matches;
  }

  private async evaluateNoteMatch(
    note: Note,
    lowerQuery: string,
  ): Promise<SearchResult | null> {
    const titleMatch = note.title?.toLowerCase().includes(lowerQuery) ?? false;
    const contentMatch = await this.matchesContent(note, lowerQuery);

    if (!titleMatch && !contentMatch) {
      return null;
    }

    const matchType: SearchResult['matchType'] = titleMatch && contentMatch
      ? 'both'
      : titleMatch
        ? 'title'
        : 'content';

    return { note, matchType };
  }

  private async matchesContent(
    note: Note,
    lowerQuery: string,
  ): Promise<boolean> {
    if (!note.filePath || !note.workspaceId) {
      return false;
    }

    try {
      const content = await this.deps.noteService.getContent(note.id);
      return Boolean(content && content.toLowerCase().includes(lowerQuery));
    } catch (error) {
      logger.debug(`[SearchService] Could not read content for note ${note.id}:`, error);
      return false;
    }
  }

  /**
   * Search notes by title only (faster)
   */
  async searchByTitle(query: string, limit: number = 20): Promise<Note[]> {
    const lowerQuery = query.toLowerCase();

    const allNotes = await this.deps.noteRepository.findAll({
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
      // Ensure embedding service is ready
      if (!this.deps.topicService.isReady()) {
        await this.deps.topicService.initialize();
      }

      return await this.deps.topicService.semanticSearch(query, limit);
    } catch (error) {
      logger.error('[SearchService] Semantic search failed:', error);
      return [];
    }
  }

  /**
   * Find notes similar to a given note
   */
  async findSimilarNotes(noteId: string, limit: number = 5): Promise<SemanticSearchResult[]> {
    try {
      // Get the note's embedding
      const embedding = await this.deps.noteRepository.getEmbedding(noteId);
      if (!embedding) {
        logger.debug(`[SearchService] No embedding found for note ${noteId}`);
        return [];
      }

      // Find similar notes
      const results = await this.deps.noteRepository.findBySimilarity(embedding, limit + 1);

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

// ==========================================================================
// Singleton for backward compatibility (IPC handlers)
// ==========================================================================

import { getRepositories } from '../repositories';
import { getNoteService } from './NoteService';
import { getTopicService } from './TopicService';

let instance: SearchService | null = null;

export function getSearchService(): SearchService {
  if (!instance) {
    const repos = getRepositories();
    instance = new SearchService({
      noteRepository: repos.note,
      noteService: getNoteService(),
      topicService: getTopicService(),
    });
  }
  return instance;
}

/**
 * Create SearchService with custom dependencies (for DI container)
 */
export function createSearchService(deps: SearchServiceDeps): SearchService {
  return new SearchService(deps);
}
