/**
 * Tag Repository Adapter
 *
 * Implements ITagRepository port using SQLite via Drizzle ORM.
 */

import { eq, sql, inArray } from 'drizzle-orm';
import { tags, noteTags, type Database } from '../../../shared';
import type { TagEntity, TagProps, ITagRepository, TagWithCount } from '../../../domain';
import { handleOperation } from '../../../shared/utils';

export interface TagRepositoryDeps {
  db: Database;
}

export class TagRepository implements ITagRepository {
  constructor(private readonly deps: TagRepositoryDeps) {}

  private handle<T>(operation: string, fn: () => Promise<T>, context?: Record<string, unknown>) {
    return handleOperation(fn, { adapter: 'TagRepository', operation, context });
  }

  async findById(id: string): Promise<TagProps | null> {
    return this.handle(
      'findById',
      async () => {
        const result = await this.deps.db.select().from(tags).where(eq(tags.id, id)).limit(1);
        return result[0] ? this.toTagProps(result[0]) : null;
      },
      { tagId: id },
    );
  }

  async findByName(name: string): Promise<TagProps | null> {
    return this.handle(
      'findByName',
      async () => {
        const normalizedName = name.toLowerCase().trim();
        const result = await this.deps.db
          .select()
          .from(tags)
          .where(eq(tags.name, normalizedName))
          .limit(1);

        return result[0] ? this.toTagProps(result[0]) : null;
      },
      { name },
    );
  }

  async findAll(): Promise<TagProps[]> {
    return this.handle('findAll', async () => {
      const result = await this.deps.db.select().from(tags);
      return result.map((row) => this.toTagProps(row));
    });
  }

  async findAllWithCounts(): Promise<TagWithCount[]> {
    return this.handle('findAllWithCounts', async () => {
      const allTags = await this.deps.db.select().from(tags);
      if (allTags.length === 0) {
        return [];
      }

      const tagIds = allTags.map((tag) => tag.id);
      const countRows = await this.deps.db
        .select({
          tagId: noteTags.tagId,
          count: sql<number>`count(*)`,
        })
        .from(noteTags)
        .where(inArray(noteTags.tagId, tagIds))
        .groupBy(noteTags.tagId);

      const countByTagId = new Map<string, number>();
      for (const row of countRows) {
        countByTagId.set(row.tagId, row.count ?? 0);
      }

      return allTags.map((tag) => ({
        ...this.toTagProps(tag),
        noteCount: countByTagId.get(tag.id) ?? 0,
      }));
    });
  }

  async findByNoteId(noteId: string): Promise<TagProps[]> {
    return this.handle(
      'findByNoteId',
      async () => {
        const result = await this.deps.db
          .select({ tag: tags })
          .from(noteTags)
          .innerJoin(tags, eq(noteTags.tagId, tags.id))
          .where(eq(noteTags.noteId, noteId));

        return result.map((row) => this.toTagProps(row.tag));
      },
      { noteId },
    );
  }

  async save(tag: TagEntity): Promise<void> {
    const props = tag.toPersistence();
    return this.handle(
      'save',
      async () => {
        const existing = await this.deps.db
          .select({ id: tags.id })
          .from(tags)
          .where(eq(tags.id, props.id))
          .limit(1);

        if (existing.length > 0) {
          await this.deps.db
            .update(tags)
            .set({
              name: props.name,
              color: props.color,
              updatedAt: props.updatedAt,
            })
            .where(eq(tags.id, props.id));
        } else {
          await this.deps.db.insert(tags).values({
            id: props.id,
            name: props.name,
            color: props.color,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
          });
        }
      },
      { tagId: props.id, name: props.name },
    );
  }

  async delete(id: string): Promise<void> {
    return this.handle(
      'delete',
      async () => {
        // Delete note-tag associations first
        await this.deps.db.delete(noteTags).where(eq(noteTags.tagId, id));
        // Delete the tag
        await this.deps.db.delete(tags).where(eq(tags.id, id));
      },
      { tagId: id },
    );
  }

  async exists(id: string): Promise<boolean> {
    return this.handle(
      'exists',
      async () => {
        const result = await this.deps.db
          .select({ id: tags.id })
          .from(tags)
          .where(eq(tags.id, id))
          .limit(1);

        return result.length > 0;
      },
      { tagId: id },
    );
  }

  async addTagToNote(noteId: string, tagId: string): Promise<void> {
    return this.handle(
      'addTagToNote',
      async () => {
        // Check if association already exists
        const existing = await this.deps.db
          .select()
          .from(noteTags)
          .where(sql`${noteTags.noteId} = ${noteId} AND ${noteTags.tagId} = ${tagId}`)
          .limit(1);

        if (existing.length === 0) {
          await this.deps.db.insert(noteTags).values({
            noteId,
            tagId,
            createdAt: new Date(),
          });
        }
      },
      { noteId, tagId },
    );
  }

  async removeTagFromNote(noteId: string, tagId: string): Promise<void> {
    return this.handle(
      'removeTagFromNote',
      async () => {
        await this.deps.db
          .delete(noteTags)
          .where(sql`${noteTags.noteId} = ${noteId} AND ${noteTags.tagId} = ${tagId}`);
      },
      { noteId, tagId },
    );
  }

  async getNoteTags(noteId: string): Promise<TagProps[]> {
    return this.handle(
      'getNoteTags',
      async () => {
        const result = await this.deps.db
          .select({ tag: tags })
          .from(noteTags)
          .innerJoin(tags, eq(noteTags.tagId, tags.id))
          .where(eq(noteTags.noteId, noteId));

        return result.map((row) => this.toTagProps(row.tag));
      },
      { noteId },
    );
  }

  async setNoteTags(noteId: string, tagIds: string[]): Promise<void> {
    return this.handle(
      'setNoteTags',
      async () => {
        // Remove all existing tags for the note
        await this.deps.db.delete(noteTags).where(eq(noteTags.noteId, noteId));

        // Add new tags
        if (tagIds.length > 0) {
          const now = new Date();
          await this.deps.db.insert(noteTags).values(
            tagIds.map((tagId) => ({
              noteId,
              tagId,
              createdAt: now,
            })),
          );
        }
      },
      { noteId, tagCount: tagIds.length },
    );
  }

  async getTagsForNotes(noteIds: string[]): Promise<Map<string, TagProps[]>> {
    return this.handle(
      'getTagsForNotes',
      async () => {
        if (noteIds.length === 0) {
          return new Map();
        }

        const result = await this.deps.db
          .select({
            noteId: noteTags.noteId,
            tag: tags,
          })
          .from(noteTags)
          .innerJoin(tags, eq(noteTags.tagId, tags.id))
          .where(inArray(noteTags.noteId, noteIds));

        const tagsMap = new Map<string, TagProps[]>();

        for (const row of result) {
          const existing = tagsMap.get(row.noteId) || [];
          existing.push(this.toTagProps(row.tag));
          tagsMap.set(row.noteId, existing);
        }

        // Ensure all noteIds are in the map (even with empty arrays)
        for (const noteId of noteIds) {
          if (!tagsMap.has(noteId)) {
            tagsMap.set(noteId, []);
          }
        }

        return tagsMap;
      },
      { noteIdCount: noteIds.length },
    );
  }

  private toTagProps(row: typeof tags.$inferSelect): TagProps {
    return {
      id: row.id,
      name: row.name,
      color: row.color ?? '#6b7280',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
