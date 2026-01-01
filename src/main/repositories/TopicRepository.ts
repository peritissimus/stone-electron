/**
 * TopicRepository - Handles topic operations and note-topic associations
 */

import { eq, sql, asc, and, desc } from 'drizzle-orm';
import { getDatabaseManager } from '../database/DatabaseManager';
import { topics, notes, noteTopics } from '../database/schema';
import { nanoid } from 'nanoid';

// Types for Topics
export interface Topic {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isPredefined: boolean | null;
  centroid: Uint8Array | Buffer | null;
  noteCount: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TopicWithCount extends Topic {
  noteCount: number;
}

export interface InsertTopic {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  isPredefined?: boolean;
  centroid?: Uint8Array | Buffer | null;
  noteCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NoteTopic {
  noteId: string;
  topicId: string;
  confidence: number | null;
  isManual: boolean | null;
  createdAt: Date;
}

export interface NoteTopicWithDetails extends NoteTopic {
  topicName: string;
  topicColor: string | null;
}

/**
 * Topic Repository - Using Drizzle ORM
 */
export class TopicRepository {
  /**
   * Create a new topic
   */
  async create(data: Partial<InsertTopic>): Promise<Topic> {
    const db = getDatabaseManager().getDrizzle();
    const now = new Date();

    const newTopic: InsertTopic = {
      id: data.id || nanoid(),
      name: data.name!,
      description: data.description || null,
      color: data.color || '#6366f1',
      isPredefined: data.isPredefined || false,
      centroid: data.centroid || null,
      noteCount: data.noteCount || 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(topics).values(newTopic);
    return newTopic as Topic;
  }

  /**
   * Find topic by ID
   */
  async findById(id: string): Promise<Topic | undefined> {
    const db = getDatabaseManager().getDrizzle();
    const result = await db.select().from(topics).where(eq(topics.id, id)).limit(1);
    return result[0] as Topic | undefined;
  }

  /**
   * Find topic by name
   */
  async findByName(name: string): Promise<Topic | undefined> {
    const db = getDatabaseManager().getDrizzle();
    const result = await db.select().from(topics).where(eq(topics.name, name)).limit(1);
    return result[0] as Topic | undefined;
  }

  /**
   * Update topic
   */
  async update(id: string, data: Partial<Topic>): Promise<Topic> {
    const db = getDatabaseManager().getDrizzle();
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };

    await db.update(topics).set(updateData).where(eq(topics.id, id));

    const updated = await this.findById(id);
    if (!updated) throw new Error('Topic not found after update');
    return updated;
  }

  /**
   * Delete topic
   */
  async delete(id: string): Promise<boolean> {
    const db = getDatabaseManager().getDrizzle();
    await db.delete(topics).where(eq(topics.id, id));
    return true;
  }

  /**
   * Execute operations in a transaction
   */
  async transaction<T>(callback: () => T | Promise<T>): Promise<T> {
    const db = getDatabaseManager().getDrizzle();
    return await db.transaction(async () => {
      return await callback();
    });
  }

  /**
   * Get all topics
   */
  async getAll(): Promise<Topic[]> {
    const db = getDatabaseManager().getDrizzle();
    const result = await db
      .select()
      .from(topics)
      .orderBy(desc(topics.isPredefined), asc(topics.name));
    return result as Topic[];
  }

  /**
   * Get all topics with actual note counts
   */
  async getAllWithCounts(): Promise<TopicWithCount[]> {
    const db = getDatabaseManager().getDrizzle();

    const result = await db
      .select({
        id: topics.id,
        name: topics.name,
        description: topics.description,
        color: topics.color,
        isPredefined: topics.isPredefined,
        centroid: topics.centroid,
        noteCount: sql<number>`COUNT(DISTINCT ${noteTopics.noteId})`,
        createdAt: topics.createdAt,
        updatedAt: topics.updatedAt,
      })
      .from(topics)
      .leftJoin(noteTopics, eq(topics.id, noteTopics.topicId))
      .leftJoin(notes, sql`${noteTopics.noteId} = ${notes.id} AND ${notes.isDeleted} = 0`)
      .groupBy(topics.id)
      .orderBy(desc(topics.isPredefined), asc(topics.name));

    return result as TopicWithCount[];
  }

  /**
   * Get predefined topics
   */
  async getPredefined(): Promise<Topic[]> {
    const db = getDatabaseManager().getDrizzle();
    const result = await db
      .select()
      .from(topics)
      .where(eq(topics.isPredefined, true))
      .orderBy(asc(topics.name));
    return result as Topic[];
  }

  /**
   * Get topics for a specific note
   */
  async getTopicsForNote(noteId: string): Promise<NoteTopicWithDetails[]> {
    const db = getDatabaseManager().getDrizzle();

    const result = await db
      .select({
        noteId: noteTopics.noteId,
        topicId: noteTopics.topicId,
        confidence: noteTopics.confidence,
        isManual: noteTopics.isManual,
        createdAt: noteTopics.createdAt,
        topicName: topics.name,
        topicColor: topics.color,
      })
      .from(noteTopics)
      .innerJoin(topics, eq(noteTopics.topicId, topics.id))
      .where(eq(noteTopics.noteId, noteId))
      .orderBy(desc(noteTopics.confidence));

    return result as NoteTopicWithDetails[];
  }

  /**
   * Get topics for multiple notes (bulk operation)
   */
  async getTopicsForNotes(noteIds: string[]): Promise<Map<string, NoteTopicWithDetails[]>> {
    const db = getDatabaseManager().getDrizzle();

    if (noteIds.length === 0) {
      return new Map();
    }

    const idPlaceholders = noteIds.map(id => sql`${id}`);
    const inClause = sql.join(idPlaceholders, sql`, `);
    const result = await db
      .select({
        noteId: noteTopics.noteId,
        topicId: noteTopics.topicId,
        confidence: noteTopics.confidence,
        isManual: noteTopics.isManual,
        createdAt: noteTopics.createdAt,
        topicName: topics.name,
        topicColor: topics.color,
      })
      .from(noteTopics)
      .innerJoin(topics, eq(noteTopics.topicId, topics.id))
      .where(sql`${noteTopics.noteId} IN (${inClause})`)
      .orderBy(desc(noteTopics.confidence));

    // Group topics by noteId
    const topicsByNote = new Map<string, NoteTopicWithDetails[]>();

    for (const row of result) {
      const topic = row as NoteTopicWithDetails;
      if (!topicsByNote.has(row.noteId)) {
        topicsByNote.set(row.noteId, []);
      }
      topicsByNote.get(row.noteId)!.push(topic);
    }

    return topicsByNote;
  }

  /**
   * Get notes for a specific topic
   */
  async getNotesForTopic(
    topicId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ noteId: string; confidence: number | null; isManual: boolean | null }[]> {
    const db = getDatabaseManager().getDrizzle();
    const { limit = 50, offset = 0 } = options;

    const result = await db
      .select({
        noteId: noteTopics.noteId,
        confidence: noteTopics.confidence,
        isManual: noteTopics.isManual,
      })
      .from(noteTopics)
      .innerJoin(notes, sql`${noteTopics.noteId} = ${notes.id} AND ${notes.isDeleted} = 0`)
      .where(eq(noteTopics.topicId, topicId))
      .orderBy(desc(noteTopics.confidence))
      .limit(limit)
      .offset(offset);

    return result;
  }

  /**
   * Assign a topic to a note
   */
  async assignToNote(
    noteId: string,
    topicId: string,
    options: { confidence?: number; isManual?: boolean } = {}
  ): Promise<void> {
    const db = getDatabaseManager().getDrizzle();
    const now = new Date();
    const { confidence = 1.0, isManual = false } = options;

    await db
      .insert(noteTopics)
      .values({
        noteId,
        topicId,
        confidence,
        isManual,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: [noteTopics.noteId, noteTopics.topicId],
        set: {
          confidence,
          isManual,
        },
      });

    // Update note count for the topic
    await this.updateNoteCount(topicId);
  }

  /**
   * Remove a topic from a note
   */
  async removeFromNote(noteId: string, topicId: string): Promise<void> {
    const db = getDatabaseManager().getDrizzle();

    await db.delete(noteTopics).where(
      and(eq(noteTopics.noteId, noteId), eq(noteTopics.topicId, topicId))
    );

    // Update note count for the topic
    await this.updateNoteCount(topicId);
  }

  /**
   * Set topics for a note (replace all existing topics)
   */
  async setTopicsForNote(
    noteId: string,
    topicAssignments: { topicId: string; confidence?: number; isManual?: boolean }[]
  ): Promise<void> {
    // Use raw client to bypass Drizzle transaction issues with libsql
    const client = getDatabaseManager().getClient();
    const now = Date.now();

    // Get existing topic IDs for this note (to update their counts later)
    const existingResult = await client.execute({
      sql: 'SELECT topic_id FROM note_topics WHERE note_id = ?',
      args: [noteId],
    });
    const existingTopicIds = existingResult.rows.map((r: any) => r.topic_id as string);

    // Remove all existing topics
    await client.execute({
      sql: 'DELETE FROM note_topics WHERE note_id = ?',
      args: [noteId],
    });

    // Add new topics
    for (const t of topicAssignments) {
      await client.execute({
        sql: 'INSERT OR REPLACE INTO note_topics (note_id, topic_id, confidence, is_manual, created_at) VALUES (?, ?, ?, ?, ?)',
        args: [noteId, t.topicId, t.confidence ?? 1.0, t.isManual ? 1 : 0, now],
      });
    }

    // Update note counts for all affected topics
    const affectedTopicIds = new Set([
      ...existingTopicIds,
      ...topicAssignments.map((t) => t.topicId),
    ]);

    for (const topicId of affectedTopicIds) {
      await this.updateNoteCount(topicId);
    }
  }

  /**
   * Update the note count for a topic
   */
  async updateNoteCount(topicId: string): Promise<void> {
    const db = getDatabaseManager().getDrizzle();

    const countResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${noteTopics.noteId})` })
      .from(noteTopics)
      .innerJoin(notes, sql`${noteTopics.noteId} = ${notes.id} AND ${notes.isDeleted} = 0`)
      .where(eq(noteTopics.topicId, topicId));

    const count = countResult[0]?.count ?? 0;

    await db
      .update(topics)
      .set({ noteCount: count, updatedAt: new Date() })
      .where(eq(topics.id, topicId));
  }

  /**
   * Update centroid for a topic (called after classification)
   */
  async updateCentroid(topicId: string, centroid: Uint8Array): Promise<void> {
    // Use raw libsql client for blob handling - Drizzle's adapter doesn't handle blobs correctly
    const client = getDatabaseManager().getClient();
    const hexString = Buffer.from(centroid).toString('hex');

    await client.execute({
      sql: `UPDATE topics SET centroid = X'${hexString}', updated_at = ? WHERE id = ?`,
      args: [Date.now(), topicId],
    });
  }

  /**
   * Delete a topic and remove all associations
   */
  async deleteWithAssociations(topicId: string): Promise<boolean> {
    return await this.transaction(async () => {
      const db = getDatabaseManager().getDrizzle();

      // Remove all note-topic associations
      await db.delete(noteTopics).where(eq(noteTopics.topicId, topicId));

      // Delete the topic
      return await this.delete(topicId);
    });
  }

  /**
   * Clear all topic assignments for a note
   */
  async clearTopicsForNote(noteId: string): Promise<void> {
    const db = getDatabaseManager().getDrizzle();

    // Get existing topic IDs first
    const existingTopics = await db
      .select({ topicId: noteTopics.topicId })
      .from(noteTopics)
      .where(eq(noteTopics.noteId, noteId));

    // Remove all topics
    await db.delete(noteTopics).where(eq(noteTopics.noteId, noteId));

    // Update counts for affected topics
    for (const { topicId } of existingTopics) {
      await this.updateNoteCount(topicId);
    }
  }
}
