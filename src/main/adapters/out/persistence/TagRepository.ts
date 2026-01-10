/**
 * Tag Repository Adapter
 *
 * Implements ITagRepository port using SQLite via Drizzle ORM.
 */

import { eq, sql, inArray } from 'drizzle-orm';
import { tags, noteTags, type Database } from '../../../shared';
import type { TagEntity, TagProps, ITagRepository, TagWithCount } from '../../../domain';

export interface TagRepositoryDeps {
  db: Database;
}

export class TagRepository implements ITagRepository {
  constructor(private readonly deps: TagRepositoryDeps) {}

  async findById(id: string): Promise<TagProps | null> {
    const result = await this.deps.db.select().from(tags).where(eq(tags.id, id)).limit(1);

    return result[0] ? this.toTagProps(result[0]) : null;
  }

  async findByName(name: string): Promise<TagProps | null> {
    const normalizedName = name.toLowerCase().trim();
    const result = await this.deps.db
      .select()
      .from(tags)
      .where(eq(tags.name, normalizedName))
      .limit(1);

    return result[0] ? this.toTagProps(result[0]) : null;
  }

  async findAll(): Promise<TagProps[]> {
    const result = await this.deps.db.select().from(tags);
    return result.map((row) => this.toTagProps(row));
  }

  async findAllWithCounts(): Promise<TagWithCount[]> {
    const allTags = await this.deps.db.select().from(tags);

    const result: TagWithCount[] = [];

    for (const tag of allTags) {
      const countResult = await this.deps.db
        .select({ count: sql<number>`count(*)` })
        .from(noteTags)
        .where(eq(noteTags.tagId, tag.id));

      result.push({
        ...this.toTagProps(tag),
        noteCount: countResult[0]?.count ?? 0,
      });
    }

    return result;
  }

  async findByNoteId(noteId: string): Promise<TagProps[]> {
    const result = await this.deps.db
      .select({ tag: tags })
      .from(noteTags)
      .innerJoin(tags, eq(noteTags.tagId, tags.id))
      .where(eq(noteTags.noteId, noteId));

    return result.map((row) => this.toTagProps(row.tag));
  }

  async save(tag: TagEntity): Promise<void> {
    const props = tag.toPersistence();
    const existing = await this.findById(props.id);

    if (existing) {
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
  }

  async delete(id: string): Promise<void> {
    // Delete note-tag associations first
    await this.deps.db.delete(noteTags).where(eq(noteTags.tagId, id));
    // Delete the tag
    await this.deps.db.delete(tags).where(eq(tags.id, id));
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.deps.db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.id, id))
      .limit(1);

    return result.length > 0;
  }

  async addTagToNote(noteId: string, tagId: string): Promise<void> {
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
  }

  async removeTagFromNote(noteId: string, tagId: string): Promise<void> {
    await this.deps.db
      .delete(noteTags)
      .where(sql`${noteTags.noteId} = ${noteId} AND ${noteTags.tagId} = ${tagId}`);
  }

  async getNoteTags(noteId: string): Promise<TagProps[]> {
    return this.findByNoteId(noteId);
  }

  async setNoteTags(noteId: string, tagIds: string[]): Promise<void> {
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
  }

  async getTagsForNotes(noteIds: string[]): Promise<Map<string, TagProps[]>> {
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
