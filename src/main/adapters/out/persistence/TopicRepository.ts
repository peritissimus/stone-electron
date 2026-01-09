/**
 * Topic Repository Implementation
 */

import { eq, and, desc } from 'drizzle-orm';
import { topics, noteTopics, type Database } from '../../../shared';
import type {
  ITopicRepository,
  TopicProps,
  TopicEntity,
  TopicWithCount,
} from '../../../domain';

export interface TopicRepositoryDeps {
  db: Database;
}

export class TopicRepository implements ITopicRepository {
  constructor(private deps: TopicRepositoryDeps) {}

  async find(id: string): Promise<TopicProps | null> {
    const result = await this.deps.db
      .select()
      .from(topics)
      .where(eq(topics.id, id))
      .limit(1);

    if (result.length === 0) return null;
    return this.toProps(result[0]);
  }

  async findById(id: string): Promise<TopicProps | null> {
    return this.find(id);
  }

  async findAll(): Promise<TopicProps[]> {
    const results = await this.deps.db.select().from(topics);
    return results.map((r) => this.toProps(r));
  }

  async findAllWithCounts(): Promise<TopicWithCount[]> {
    const allTopics = await this.findAll();
    const result: TopicWithCount[] = [];

    for (const topic of allTopics) {
      const count = await this.countNotesByTopic(topic.id);
      result.push({ ...topic, noteCount: count });
    }

    return result;
  }

  async findPredefined(): Promise<TopicProps[]> {
    const results = await this.deps.db
      .select()
      .from(topics)
      .where(eq(topics.isPredefined, true));
    return results.map((r) => this.toProps(r));
  }

  async findByName(name: string): Promise<TopicProps | null> {
    const result = await this.deps.db
      .select()
      .from(topics)
      .where(eq(topics.name, name))
      .limit(1);

    if (result.length === 0) return null;
    return this.toProps(result[0]);
  }

  async save(topic: TopicEntity): Promise<void> {
    await this.deps.db
      .insert(topics)
      .values({
        id: topic.id,
        name: topic.name,
        description: topic.description,
        color: topic.color,
        isPredefined: topic.isPredefined,
        centroid: topic.centroid ? Buffer.from(topic.centroid.buffer) : null,
        createdAt: topic.createdAt,
        updatedAt: topic.updatedAt,
      })
      .onConflictDoUpdate({
        target: topics.id,
        set: {
          name: topic.name,
          description: topic.description,
          color: topic.color,
          centroid: topic.centroid ? Buffer.from(topic.centroid.buffer) : null,
          updatedAt: new Date(),
        },
      });
  }

  async delete(id: string): Promise<void> {
    // Delete associations first
    await this.deps.db.delete(noteTopics).where(eq(noteTopics.topicId, id));
    // Delete topic
    await this.deps.db.delete(topics).where(eq(topics.id, id));
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.deps.db
      .select({ id: topics.id })
      .from(topics)
      .where(eq(topics.id, id))
      .limit(1);
    return result.length > 0;
  }

  async getTopicsForNote(noteId: string): Promise<Array<{ noteId: string; topicId: string; confidence: number; isManual: boolean; createdAt: Date; topicName: string; topicColor: string }>> {
    const results = await this.deps.db
      .select()
      .from(noteTopics)
      .where(eq(noteTopics.noteId, noteId));

    const topicsWithDetails: Array<{ noteId: string; topicId: string; confidence: number; isManual: boolean; createdAt: Date; topicName: string; topicColor: string }> = [];
    for (const result of results) {
      const topic = await this.find(result.topicId);
      if (topic) {
        topicsWithDetails.push({
          noteId: result.noteId,
          topicId: result.topicId,
          confidence: result.confidence || 0,
          isManual: result.isManual || false,
          createdAt: result.createdAt,
          topicName: topic.name,
          topicColor: topic.color,
        });
      }
    }
    return topicsWithDetails;
  }

  async getNoteIdsByTopic(topicId: string): Promise<string[]> {
    const results = await this.deps.db
      .select({ noteId: noteTopics.noteId })
      .from(noteTopics)
      .where(eq(noteTopics.topicId, topicId));
    return results.map((r) => r.noteId);
  }

  async assignNoteToTopic(noteId: string, topicId: string, confidence: number): Promise<void> {
    await this.deps.db
      .insert(noteTopics)
      .values({
        noteId,
        topicId,
        confidence,
        isManual: false,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [noteTopics.noteId, noteTopics.topicId],
        set: {
          confidence,
        },
      });
  }

  async removeNoteFromTopic(noteId: string, topicId: string): Promise<void> {
    await this.deps.db
      .delete(noteTopics)
      .where(and(eq(noteTopics.noteId, noteId), eq(noteTopics.topicId, topicId)));
  }

  async countNotesByTopic(topicId: string): Promise<number> {
    const results = await this.deps.db
      .select()
      .from(noteTopics)
      .where(eq(noteTopics.topicId, topicId));
    return results.length;
  }

  async updateCentroid(topicId: string, centroid: Uint8Array): Promise<void> {
    await this.deps.db
      .update(topics)
      .set({ centroid: Buffer.from(centroid) })
      .where(eq(topics.id, topicId));
  }

  async getTopicsForNotes(noteIds: string[]): Promise<Map<string, Array<{ noteId: string; topicId: string; confidence: number; isManual: boolean; createdAt: Date; topicName: string; topicColor: string }>>> {
    const result = new Map<string, Array<{ noteId: string; topicId: string; confidence: number; isManual: boolean; createdAt: Date; topicName: string; topicColor: string }>>();
    for (const noteId of noteIds) {
      const topics = await this.getTopicsForNote(noteId);
      result.set(noteId, topics);
    }
    return result;
  }

  async getNotesForTopic(topicId: string, options?: { limit?: number; offset?: number; excludeJournal?: boolean }): Promise<{ noteId: string; confidence: number; isManual: boolean }[]> {
    const results = await this.deps.db
      .select()
      .from(noteTopics)
      .where(eq(noteTopics.topicId, topicId));

    return results.map((r) => ({
      noteId: r.noteId,
      confidence: r.confidence || 0,
      isManual: r.isManual || false,
    }));
  }

  async assignToNote(noteId: string, topicId: string, options?: { confidence?: number; isManual?: boolean }): Promise<void> {
    await this.assignNoteToTopic(noteId, topicId, options?.confidence || 0);
  }

  async removeFromNote(noteId: string, topicId: string): Promise<void> {
    await this.removeNoteFromTopic(noteId, topicId);
  }

  async setTopicsForNote(noteId: string, assignments: { topicId: string; confidence?: number; isManual?: boolean }[]): Promise<void> {
    await this.clearTopicsForNote(noteId);
    for (const assignment of assignments) {
      await this.assignNoteToTopic(noteId, assignment.topicId, assignment.confidence || 0);
    }
  }

  async clearTopicsForNote(noteId: string): Promise<void> {
    await this.deps.db.delete(noteTopics).where(eq(noteTopics.noteId, noteId));
  }

  async updateNoteCount(topicId: string): Promise<void> {
    // Note count is computed dynamically, no update needed
  }

  private toProps(row: typeof topics.$inferSelect): TopicProps {
    let centroid: Uint8Array | null = null;
    if (row.centroid) {
      // Convert Buffer/Uint8Array to Uint8Array
      const rawCentroid = row.centroid as Buffer | Uint8Array;
      if (Buffer.isBuffer(rawCentroid)) {
        centroid = new Uint8Array(rawCentroid.buffer, rawCentroid.byteOffset, rawCentroid.byteLength);
      } else {
        centroid = rawCentroid;
      }
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      color: row.color ?? '#6366f1',
      isPredefined: row.isPredefined ?? false,
      centroid,
      noteCount: 0, // Computed separately when needed
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
