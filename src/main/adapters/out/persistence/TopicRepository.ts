/**
 * Topic Repository Implementation
 */

import { eq, and, inArray, sql } from 'drizzle-orm';
import { topics, noteTopics, type Database } from '../../../shared';
import type { ITopicRepository, TopicProps, TopicEntity, TopicWithCount } from '../../../domain';
import { handleOperation } from '../../../shared/utils';

export interface TopicRepositoryDeps {
  db: Database;
}

export class TopicRepository implements ITopicRepository {
  constructor(private deps: TopicRepositoryDeps) {}

  private handle<T>(operation: string, fn: () => Promise<T>, context?: Record<string, unknown>) {
    return handleOperation(fn, { adapter: 'TopicRepository', operation, context });
  }

  async find(id: string): Promise<TopicProps | null> {
    return this.handle(
      'find',
      async () => {
        const result = await this.deps.db.select().from(topics).where(eq(topics.id, id)).limit(1);
        if (result.length === 0) return null;
        return this.toProps(result[0]);
      },
      { topicId: id },
    );
  }

  async findById(id: string): Promise<TopicProps | null> {
    return this.find(id);
  }

  async findAll(): Promise<TopicProps[]> {
    return this.handle('findAll', async () => {
      const results = await this.deps.db.select().from(topics);
      return results.map((r) => this.toProps(r));
    });
  }

  async findAllWithCounts(): Promise<TopicWithCount[]> {
    return this.handle('findAllWithCounts', async () => {
      const allTopics = await this.deps.db.select().from(topics);
      if (allTopics.length === 0) {
        return [];
      }

      const topicIds = allTopics.map((topic) => topic.id);
      const countRows = await this.deps.db
        .select({
          topicId: noteTopics.topicId,
          count: sql<number>`count(*)`,
        })
        .from(noteTopics)
        .where(inArray(noteTopics.topicId, topicIds))
        .groupBy(noteTopics.topicId);

      const countByTopicId = new Map<string, number>();
      for (const row of countRows) {
        countByTopicId.set(row.topicId, row.count ?? 0);
      }

      return allTopics.map((topic) => ({
        ...this.toProps(topic),
        noteCount: countByTopicId.get(topic.id) ?? 0,
      }));
    });
  }

  async findPredefined(): Promise<TopicProps[]> {
    return this.handle('findPredefined', async () => {
      const results = await this.deps.db.select().from(topics).where(eq(topics.isPredefined, true));
      return results.map((r) => this.toProps(r));
    });
  }

  async findByName(name: string): Promise<TopicProps | null> {
    return this.handle(
      'findByName',
      async () => {
        const result = await this.deps.db
          .select()
          .from(topics)
          .where(eq(topics.name, name))
          .limit(1);
        if (result.length === 0) return null;
        return this.toProps(result[0]);
      },
      { name },
    );
  }

  async save(topic: TopicEntity): Promise<void> {
    return this.handle(
      'save',
      async () => {
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
      },
      { topicId: topic.id, name: topic.name },
    );
  }

  async delete(id: string): Promise<void> {
    return this.handle(
      'delete',
      async () => {
        // Delete associations first
        await this.deps.db.delete(noteTopics).where(eq(noteTopics.topicId, id));
        // Delete topic
        await this.deps.db.delete(topics).where(eq(topics.id, id));
      },
      { topicId: id },
    );
  }

  async exists(id: string): Promise<boolean> {
    return this.handle(
      'exists',
      async () => {
        const result = await this.deps.db
          .select({ id: topics.id })
          .from(topics)
          .where(eq(topics.id, id))
          .limit(1);
        return result.length > 0;
      },
      { topicId: id },
    );
  }

  async getTopicsForNote(
    noteId: string,
  ): Promise<
    Array<{
      noteId: string;
      topicId: string;
      confidence: number;
      isManual: boolean;
      createdAt: Date;
      topicName: string;
      topicColor: string;
    }>
  > {
    return this.handle(
      'getTopicsForNote',
      async () => {
        const results = await this.deps.db
          .select()
          .from(noteTopics)
          .where(eq(noteTopics.noteId, noteId));

        const topicsWithDetails: Array<{
          noteId: string;
          topicId: string;
          confidence: number;
          isManual: boolean;
          createdAt: Date;
          topicName: string;
          topicColor: string;
        }> = [];
        for (const result of results) {
          const topicResult = await this.deps.db
            .select()
            .from(topics)
            .where(eq(topics.id, result.topicId))
            .limit(1);
          if (topicResult.length > 0) {
            const topic = this.toProps(topicResult[0]);
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
      },
      { noteId },
    );
  }

  async getNoteIdsByTopic(topicId: string): Promise<string[]> {
    return this.handle(
      'getNoteIdsByTopic',
      async () => {
        const results = await this.deps.db
          .select({ noteId: noteTopics.noteId })
          .from(noteTopics)
          .where(eq(noteTopics.topicId, topicId));
        return results.map((r) => r.noteId);
      },
      { topicId },
    );
  }

  async assignNoteToTopic(noteId: string, topicId: string, confidence: number): Promise<void> {
    return this.handle(
      'assignNoteToTopic',
      async () => {
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
      },
      { noteId, topicId, confidence },
    );
  }

  async removeNoteFromTopic(noteId: string, topicId: string): Promise<void> {
    return this.handle(
      'removeNoteFromTopic',
      async () => {
        await this.deps.db
          .delete(noteTopics)
          .where(and(eq(noteTopics.noteId, noteId), eq(noteTopics.topicId, topicId)));
      },
      { noteId, topicId },
    );
  }

  async countNotesByTopic(topicId: string): Promise<number> {
    return this.handle(
      'countNotesByTopic',
      async () => {
        const results = await this.deps.db
          .select()
          .from(noteTopics)
          .where(eq(noteTopics.topicId, topicId));
        return results.length;
      },
      { topicId },
    );
  }

  async updateCentroid(topicId: string, centroid: Uint8Array): Promise<void> {
    return this.handle(
      'updateCentroid',
      async () => {
        await this.deps.db
          .update(topics)
          .set({ centroid: Buffer.from(centroid) })
          .where(eq(topics.id, topicId));
      },
      { topicId },
    );
  }

  async getTopicsForNotes(
    noteIds: string[],
  ): Promise<
    Map<
      string,
      Array<{
        noteId: string;
        topicId: string;
        confidence: number;
        isManual: boolean;
        createdAt: Date;
        topicName: string;
        topicColor: string;
      }>
    >
  > {
    return this.handle(
      'getTopicsForNotes',
      async () => {
        const result = new Map<
          string,
          Array<{
            noteId: string;
            topicId: string;
            confidence: number;
            isManual: boolean;
            createdAt: Date;
            topicName: string;
            topicColor: string;
          }>
        >();
        for (const noteId of noteIds) {
          const noteTopicResults = await this.deps.db
            .select()
            .from(noteTopics)
            .where(eq(noteTopics.noteId, noteId));

          const topicsWithDetails: Array<{
            noteId: string;
            topicId: string;
            confidence: number;
            isManual: boolean;
            createdAt: Date;
            topicName: string;
            topicColor: string;
          }> = [];

          for (const nt of noteTopicResults) {
            const topicResult = await this.deps.db
              .select()
              .from(topics)
              .where(eq(topics.id, nt.topicId))
              .limit(1);
            if (topicResult.length > 0) {
              const topic = this.toProps(topicResult[0]);
              topicsWithDetails.push({
                noteId: nt.noteId,
                topicId: nt.topicId,
                confidence: nt.confidence || 0,
                isManual: nt.isManual || false,
                createdAt: nt.createdAt,
                topicName: topic.name,
                topicColor: topic.color,
              });
            }
          }
          result.set(noteId, topicsWithDetails);
        }
        return result;
      },
      { noteIdCount: noteIds.length },
    );
  }

  async getNotesForTopic(
    topicId: string,
    _options?: { limit?: number; offset?: number; excludeJournal?: boolean },
  ): Promise<{ noteId: string; confidence: number; isManual: boolean }[]> {
    return this.handle(
      'getNotesForTopic',
      async () => {
        const results = await this.deps.db
          .select()
          .from(noteTopics)
          .where(eq(noteTopics.topicId, topicId));

        return results.map((r) => ({
          noteId: r.noteId,
          confidence: r.confidence || 0,
          isManual: r.isManual || false,
        }));
      },
      { topicId },
    );
  }

  async assignToNote(
    noteId: string,
    topicId: string,
    options?: { confidence?: number; isManual?: boolean },
  ): Promise<void> {
    return this.handle(
      'assignToNote',
      async () => {
        await this.deps.db
          .insert(noteTopics)
          .values({
            noteId,
            topicId,
            confidence: options?.confidence || 0,
            isManual: false,
            createdAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [noteTopics.noteId, noteTopics.topicId],
            set: {
              confidence: options?.confidence || 0,
            },
          });
      },
      { noteId, topicId },
    );
  }

  async removeFromNote(noteId: string, topicId: string): Promise<void> {
    return this.handle(
      'removeFromNote',
      async () => {
        await this.deps.db
          .delete(noteTopics)
          .where(and(eq(noteTopics.noteId, noteId), eq(noteTopics.topicId, topicId)));
      },
      { noteId, topicId },
    );
  }

  async setTopicsForNote(
    noteId: string,
    assignments: { topicId: string; confidence?: number; isManual?: boolean }[],
  ): Promise<void> {
    return this.handle(
      'setTopicsForNote',
      async () => {
        await this.deps.db.delete(noteTopics).where(eq(noteTopics.noteId, noteId));
        for (const assignment of assignments) {
          await this.deps.db.insert(noteTopics).values({
            noteId,
            topicId: assignment.topicId,
            confidence: assignment.confidence || 0,
            isManual: false,
            createdAt: new Date(),
          });
        }
      },
      { noteId, assignmentCount: assignments.length },
    );
  }

  async clearTopicsForNote(noteId: string): Promise<void> {
    return this.handle(
      'clearTopicsForNote',
      async () => {
        await this.deps.db.delete(noteTopics).where(eq(noteTopics.noteId, noteId));
      },
      { noteId },
    );
  }

  async clearAutoTopicsForNote(noteId: string): Promise<void> {
    return this.handle(
      'clearAutoTopicsForNote',
      async () => {
        await this.deps.db
          .delete(noteTopics)
          .where(and(eq(noteTopics.noteId, noteId), eq(noteTopics.isManual, false)));
      },
      { noteId },
    );
  }

  async updateNoteCount(topicId: string): Promise<void> {
    return this.handle(
      'updateNoteCount',
      async () => {
        // Note count is computed dynamically, no update needed
      },
      { topicId },
    );
  }

  private toProps(row: typeof topics.$inferSelect): TopicProps {
    let centroid: Uint8Array | null = null;
    if (row.centroid) {
      // Convert Buffer/Uint8Array to Uint8Array
      const rawCentroid = row.centroid as Buffer | Uint8Array;
      if (Buffer.isBuffer(rawCentroid)) {
        centroid = new Uint8Array(
          rawCentroid.buffer,
          rawCentroid.byteOffset,
          rawCentroid.byteLength,
        );
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
