/**
 * GraphService - Note graph and backlink management
 *
 * Handles note linking, backlinks, and graph visualization data.
 */

import { getRepositories } from '../repositories';
import { logger } from '../utils/logger';
import type { Note } from '@shared/types';

export interface BacklinkInfo {
  id: string;
  title: string;
  updatedAt: Date;
}

export interface LinkInfo {
  id: string;
  title: string;
}

export interface GraphNode {
  id: string;
  name: string;
  val: number;
  color?: string;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

/**
 * GraphService handles note linking and graph operations
 */
class GraphService {
  // Cache for graph data (TTL-based)
  private graphCache: { data: GraphData | null; timestamp: number } = { data: null, timestamp: 0 };
  private static readonly GRAPH_CACHE_TTL_MS = 30000; // 30 seconds

  // Cache for note title -> note lookup (invalidated on create/delete/rename)
  private noteTitleCache: Map<string, Note> | null = null;

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  /**
   * Invalidate title cache
   */
  invalidateTitleCache(): void {
    this.noteTitleCache = null;
  }

  /**
   * Invalidate graph cache
   */
  invalidateGraphCache(): void {
    this.graphCache = { data: null, timestamp: 0 };
  }

  /**
   * Invalidate all caches
   */
  invalidateAllCaches(): void {
    this.invalidateTitleCache();
    this.invalidateGraphCache();
  }

  // ==========================================================================
  // Link Operations
  // ==========================================================================

  /**
   * Get backlinks for a note (notes that link to this note)
   */
  async getBacklinks(noteId: string): Promise<BacklinkInfo[]> {
    const repos = getRepositories();
    const notes = await repos.note.getBacklinks(noteId);

    return notes.map((note) => ({
      id: note.id,
      title: note.title || 'Untitled',
      updatedAt: note.updatedAt,
    }));
  }

  /**
   * Get forward links from a note (notes this note links to)
   */
  async getForwardLinks(noteId: string): Promise<LinkInfo[]> {
    const repos = getRepositories();
    const notes = await repos.note.getForwardLinks(noteId);

    return notes.map((note) => ({
      id: note.id,
      title: note.title || 'Untitled',
    }));
  }

  /**
   * Update links from content - extract [[note name]] patterns
   * Uses cached title map for performance
   */
  async updateLinksFromContent(sourceNoteId: string, markdownContent: string): Promise<void> {
    const repos = getRepositories();

    try {
      // Extract all [[note name]] patterns from the content
      // Limit capture to 500 chars to prevent excessive matching
      const linkPattern = /\[\[([^\]]{1,500})\]\]/g;
      const matches = markdownContent.matchAll(linkPattern);
      const linkedTitles = new Set<string>();

      for (const match of matches) {
        linkedTitles.add(match[1].trim());
      }

      // Skip expensive operations if no links in content
      if (linkedTitles.size === 0) {
        // Remove any existing links
        const currentLinks = await this.getForwardLinks(sourceNoteId);
        for (const link of currentLinks) {
          await repos.note.removeLink(sourceNoteId, link.id);
        }
        return;
      }

      // Get current forward links
      const currentLinks = await this.getForwardLinks(sourceNoteId);
      const currentLinkIds = new Set(currentLinks.map((n) => n.id));

      // Use cached title map instead of loading all notes every time
      const notesByTitle = await this.getNoteTitleMap();

      // Resolve titles to note IDs
      const targetNoteIds = new Set<string>();
      for (const title of linkedTitles) {
        const targetNote = notesByTitle.get(title.toLowerCase());
        if (targetNote && targetNote.id !== sourceNoteId) {
          targetNoteIds.add(targetNote.id);
        }
      }

      // Remove links that no longer exist
      for (const currentId of currentLinkIds) {
        if (!targetNoteIds.has(currentId)) {
          await repos.note.removeLink(sourceNoteId, currentId);
        }
      }

      // Add new links
      for (const targetId of targetNoteIds) {
        if (!currentLinkIds.has(targetId)) {
          await repos.note.addLink(sourceNoteId, targetId);
        }
      }

      logger.info(`[GraphService] Updated links for note ${sourceNoteId}: ${targetNoteIds.size} links`);
    } catch (error) {
      logger.error(`[GraphService] Failed to update links for note ${sourceNoteId}:`, error);
    }
  }

  // ==========================================================================
  // Graph Data
  // ==========================================================================

  /**
   * Get graph data for visualization
   * Uses TTL-based caching to avoid expensive queries
   */
  async getGraphData(): Promise<GraphData> {
    // Check cache first
    const now = Date.now();
    if (this.graphCache.data && now - this.graphCache.timestamp < GraphService.GRAPH_CACHE_TTL_MS) {
      logger.debug('[GraphService] Graph data served from cache');
      return this.graphCache.data;
    }

    const repos = getRepositories();

    try {
      // Get all non-deleted notes
      const allNotes = await repos.note.findAll({ where: { isDeleted: false } });

      // Get all links via raw query (more efficient)
      const allLinks = await repos.note.getAllLinks();

      // Create nodes with link counts for sizing
      const linkCounts = new Map<string, number>();
      for (const link of allLinks) {
        linkCounts.set(link.sourceNoteId, (linkCounts.get(link.sourceNoteId) || 0) + 1);
        linkCounts.set(link.targetNoteId, (linkCounts.get(link.targetNoteId) || 0) + 1);
      }

      const noteIdSet = new Set(allNotes.map((n) => n.id));
      const nodes: GraphNode[] = allNotes.map((note) => ({
        id: note.id,
        name: note.title || 'Untitled',
        val: 1 + (linkCounts.get(note.id) || 0), // Size based on connections
      }));

      // Filter links to only include existing notes
      const links: GraphLink[] = allLinks
        .filter((link) => noteIdSet.has(link.sourceNoteId) && noteIdSet.has(link.targetNoteId))
        .map((link) => ({
          source: link.sourceNoteId,
          target: link.targetNoteId,
        }));

      // Update cache
      const result = { nodes, links };
      this.graphCache = { data: result, timestamp: now };

      logger.info(`[GraphService] Graph data: ${nodes.length} nodes, ${links.length} links`);
      return result;
    } catch (error) {
      logger.error('[GraphService] Failed to get graph data:', error);
      return { nodes: [], links: [] };
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Get or build the note title lookup map (cached)
   */
  private async getNoteTitleMap(): Promise<Map<string, Note>> {
    if (this.noteTitleCache) {
      return this.noteTitleCache;
    }

    const repos = getRepositories();
    const allNotes = await repos.note.findAll({ where: { isDeleted: false } });

    this.noteTitleCache = new Map();
    for (const note of allNotes) {
      if (note.title) {
        this.noteTitleCache.set(note.title.toLowerCase(), note);
      }
    }

    return this.noteTitleCache;
  }
}

// Singleton instance
let instance: GraphService | null = null;

export function getGraphService(): GraphService {
  instance ??= new GraphService();
  return instance;
}
