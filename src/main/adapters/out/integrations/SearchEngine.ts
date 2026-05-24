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
  SearchOptions,
  DateRangeOptions,
  INoteRepository,
} from '../../../domain';

export interface SearchEngineDeps {
  db: Database;
  noteRepository: INoteRepository;
}

export class SearchEngine implements ISearchEngine {
  constructor(private readonly deps: SearchEngineDeps) {}

  async searchFullText(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    const limit = options?.limit ?? 50;
    const searchQuery = query.replace(/[^\w\s]/g, ' ').trim();

    // Title-prefix search only. The richer chunk-level FTS lives in
    // IIndexRepository.searchFullText — that's what AskNotes and the
    // Knowledge page semantic search use.
    const conditions: any[] = [eq(notes.isDeleted, false), like(notes.title, `%${searchQuery}%`)];

    if (options?.workspaceId) {
      conditions.push(eq(notes.workspaceId, options.workspaceId));
    }
    if (options?.notebookId) {
      conditions.push(eq(notes.notebookId, options.notebookId));
    }

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
