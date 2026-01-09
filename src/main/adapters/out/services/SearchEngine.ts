/**
 * Search Engine Adapter
 *
 * Implements ISearchEngine port using SQLite FTS and embeddings.
 */

import { eq, and, sql, between, inArray, desc, like } from 'drizzle-orm';
import { notes, noteTags, type Database } from '../../../shared';
import type {
  NoteProps,
  ISearchEngine,
  SearchResult,
  SemanticSearchResult,
  SearchOptions,
  DateRangeOptions,
  INoteRepository,
  IEmbeddingService,
} from '../../../domain';

export interface SearchEngineDeps {
  db: Database;
  noteRepository: INoteRepository;
  embeddingService: IEmbeddingService;
}

export class SearchEngine implements ISearchEngine {
  constructor(private readonly deps: SearchEngineDeps) {}

  async searchFullText(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    const limit = options?.limit ?? 50;
    const searchQuery = query.replace(/[^\w\s]/g, ' ').trim();

    // Build conditions for search
    const conditions: any[] = [eq(notes.isDeleted, false), like(notes.title, `%${searchQuery}%`)];

    if (options?.workspaceId) {
      conditions.push(eq(notes.workspaceId, options.workspaceId));
    }
    if (options?.notebookId) {
      conditions.push(eq(notes.notebookId, options.notebookId));
    }

    // Simple title-based search (FTS5 tables need raw SQL access)
    const searchResults = await this.deps.db
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(desc(notes.updatedAt))
      .limit(limit);

    return searchResults.map((row, index) => ({
      note: this.toNoteProps(row),
      relevance: 1 - index / searchResults.length,
      matchType: 'title' as const,
    }));
  }

  async searchSemantic(query: string, options?: SearchOptions): Promise<SemanticSearchResult[]> {
    const limit = options?.limit ?? 10;
    const similarNotes = await this.deps.embeddingService.semanticSearch(query, limit);

    return similarNotes.map((note) => ({
      noteId: note.noteId,
      title: note.title,
      similarity: note.similarity,
      distance: note.distance,
    }));
  }

  async searchHybrid(
    query: string,
    options?: SearchOptions & { weights?: { fts: number; semantic: number } },
  ): Promise<SearchResult[]> {
    const weights = options?.weights ?? { fts: 0.7, semantic: 0.3 };
    const limit = options?.limit ?? 50;

    // Get FTS results
    const ftsResults = await this.searchFullText(query, { ...options, limit: limit * 2 });

    // Get semantic results
    const semanticResults = await this.searchSemantic(query, { ...options, limit: limit * 2 });

    // Merge and score
    const scoreMap = new Map<string, { note: NoteProps; score: number }>();

    // Add FTS scores
    for (let i = 0; i < ftsResults.length; i++) {
      const result = ftsResults[i];
      const normalizedScore = 1 - i / ftsResults.length;
      scoreMap.set(result.note.id, {
        note: result.note,
        score: normalizedScore * weights.fts,
      });
    }

    // Add semantic scores
    for (let i = 0; i < semanticResults.length; i++) {
      const result = semanticResults[i];
      const normalizedScore = 1 - i / semanticResults.length;
      const existing = scoreMap.get(result.noteId);

      if (existing) {
        existing.score += normalizedScore * weights.semantic;
      } else {
        const note = await this.deps.noteRepository.findById(result.noteId);
        if (note) {
          scoreMap.set(result.noteId, {
            note,
            score: normalizedScore * weights.semantic,
          });
        }
      }
    }

    // Sort by combined score
    const combined = Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return combined.map(({ note, score }) => ({
      note,
      relevance: score,
      matchType: 'both' as const,
    }));
  }

  async searchByTags(
    tagIds: string[],
    options?: SearchOptions & { matchAll?: boolean },
  ): Promise<NoteProps[]> {
    if (tagIds.length === 0) {
      return [];
    }

    const limit = options?.limit ?? 50;
    const matchAll = options?.matchAll ?? false;
    const workspaceId = options?.workspaceId;

    if (matchAll) {
      // Notes that have ALL the specified tags
      const result = await this.deps.db
        .select({ noteId: noteTags.noteId })
        .from(noteTags)
        .where(inArray(noteTags.tagId, tagIds))
        .groupBy(noteTags.noteId)
        .having(sql`count(distinct ${noteTags.tagId}) = ${tagIds.length}`);

      const noteIds = result.map((r) => r.noteId);
      const notesResult: NoteProps[] = [];

      for (const noteId of noteIds) {
        const note = await this.deps.noteRepository.findById(noteId);
        if (note && !note.isDeleted && (!workspaceId || note.workspaceId === workspaceId)) {
          notesResult.push(note);
        }
        if (notesResult.length >= limit) break;
      }

      return notesResult;
    } else {
      // Notes that have ANY of the specified tags
      const result = await this.deps.db
        .selectDistinct({ noteId: noteTags.noteId })
        .from(noteTags)
        .where(inArray(noteTags.tagId, tagIds));

      const noteIds = result.map((r) => r.noteId);
      const notesResult: NoteProps[] = [];

      for (const noteId of noteIds) {
        const note = await this.deps.noteRepository.findById(noteId);
        if (note && !note.isDeleted && (!workspaceId || note.workspaceId === workspaceId)) {
          notesResult.push(note);
        }
        if (notesResult.length >= limit) break;
      }

      return notesResult;
    }
  }

  async searchByDateRange(options: DateRangeOptions): Promise<NoteProps[]> {
    const limit = options.limit ?? 50;
    const field = options.field ?? 'updated';
    const dateColumn = field === 'created' ? notes.createdAt : notes.updatedAt;

    const conditions: any[] = [
      eq(notes.isDeleted, false),
      between(dateColumn, options.startDate, options.endDate),
    ];

    if (options.workspaceId) {
      conditions.push(eq(notes.workspaceId, options.workspaceId));
    }

    const result = await this.deps.db
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(desc(dateColumn))
      .limit(limit);

    return result.map((row) => this.toNoteProps(row));
  }

  async indexNote(noteId: string, title: string, content: string): Promise<void> {
    // FTS5 tables need raw SQL - using db.run for direct SQL
    // This is a stub - actual implementation would use raw SQL
    await this.deps.db.run(
      sql`INSERT OR REPLACE INTO notes_fts (note_id, title, content) VALUES (${noteId}, ${title}, ${content})`,
    );
  }

  async removeFromIndex(noteId: string): Promise<void> {
    // FTS5 tables need raw SQL
    await this.deps.db.run(sql`DELETE FROM notes_fts WHERE note_id = ${noteId}`);
  }

  async rebuildIndex(): Promise<void> {
    // Clear existing index
    await this.deps.db.run(sql`DELETE FROM notes_fts`);

    // Get all notes
    const allNotes = await this.deps.noteRepository.findAll({ isDeleted: false });

    // Re-index each note
    for (const note of allNotes) {
      const content = await this.deps.noteRepository.getContentById(note.id);
      await this.indexNote(note.id, note.title, content ?? '');
    }
  }

  private toNoteProps(row: typeof notes.$inferSelect): NoteProps {
    return {
      id: row.id,
      title: row.title ?? 'Untitled',
      notebookId: row.notebookId ?? null,
      workspaceId: row.workspaceId ?? null,
      filePath: row.filePath ?? null,
      isFavorite: row.isFavorite ?? false,
      isPinned: row.isPinned ?? false,
      isArchived: row.isArchived ?? false,
      isDeleted: row.isDeleted ?? false,
      deletedAt: row.deletedAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
