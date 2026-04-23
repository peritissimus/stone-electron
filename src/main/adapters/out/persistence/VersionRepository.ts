/**
 * Version Repository Implementation
 */

import { eq, desc } from 'drizzle-orm';
import { noteVersions, type Database } from '../../../shared';
import type {
  IVersionRepository,
  VersionProps,
  VersionEntity,
  VersionSummary,
} from '../../../domain';
import { handleOperation } from '../../../shared/utils';

export interface VersionRepositoryDeps {
  db: Database;
}

export class VersionRepository implements IVersionRepository {
  constructor(private deps: VersionRepositoryDeps) {}

  private handle<T>(operation: string, fn: () => Promise<T>, context?: Record<string, unknown>) {
    return handleOperation(fn, { adapter: 'VersionRepository', operation, context });
  }

  async findById(id: string): Promise<VersionProps | null> {
    return this.handle(
      'findById',
      async () => {
        const result = await this.deps.db
          .select()
          .from(noteVersions)
          .where(eq(noteVersions.id, id))
          .limit(1);

        if (result.length === 0) return null;
        return this.toProps(result[0]);
      },
      { versionId: id },
    );
  }

  async findByNoteId(noteId: string): Promise<VersionProps[]> {
    return this.handle(
      'findByNoteId',
      async () => {
        const results = await this.deps.db
          .select()
          .from(noteVersions)
          .where(eq(noteVersions.noteId, noteId))
          .orderBy(desc(noteVersions.versionNumber));

        return results.map((r) => this.toProps(r));
      },
      { noteId },
    );
  }

  async getVersionSummary(noteId: string): Promise<VersionSummary[]> {
    return this.handle(
      'getVersionSummary',
      async () => {
        const results = await this.deps.db
          .select()
          .from(noteVersions)
          .where(eq(noteVersions.noteId, noteId))
          .orderBy(desc(noteVersions.versionNumber));

        return results.map((r) => {
          const v = this.toProps(r);
          return {
            id: v.id,
            noteId: v.noteId,
            versionNumber: v.versionNumber,
            title: v.title,
            createdAt: v.createdAt,
            contentLength: v.content.length,
          };
        });
      },
      { noteId },
    );
  }

  async getLatestVersion(noteId: string): Promise<VersionProps | null> {
    return this.handle(
      'getLatestVersion',
      async () => {
        const result = await this.deps.db
          .select()
          .from(noteVersions)
          .where(eq(noteVersions.noteId, noteId))
          .orderBy(desc(noteVersions.versionNumber))
          .limit(1);

        if (result.length === 0) return null;
        return this.toProps(result[0]);
      },
      { noteId },
    );
  }

  async getNextVersionNumber(noteId: string): Promise<number> {
    return this.handle(
      'getNextVersionNumber',
      async () => {
        const result = await this.deps.db
          .select()
          .from(noteVersions)
          .where(eq(noteVersions.noteId, noteId))
          .orderBy(desc(noteVersions.versionNumber))
          .limit(1);

        if (result.length === 0) return 1;
        return this.toProps(result[0]).versionNumber + 1;
      },
      { noteId },
    );
  }

  async save(version: VersionEntity): Promise<void> {
    return this.handle(
      'save',
      async () => {
        await this.deps.db
          .insert(noteVersions)
          .values({
            id: version.id,
            noteId: version.noteId,
            versionNumber: version.versionNumber,
            title: version.title,
            content: version.content,
            createdAt: version.createdAt,
          })
          .onConflictDoUpdate({
            target: noteVersions.id,
            set: {
              title: version.title,
              content: version.content,
            },
          });
      },
      { versionId: version.id, noteId: version.noteId, versionNumber: version.versionNumber },
    );
  }

  async deleteByNoteId(noteId: string): Promise<void> {
    return this.handle(
      'deleteByNoteId',
      async () => {
        await this.deps.db.delete(noteVersions).where(eq(noteVersions.noteId, noteId));
      },
      { noteId },
    );
  }

  async pruneVersions(noteId: string, keepCount: number): Promise<number> {
    return this.handle(
      'pruneVersions',
      async () => {
        const results = await this.deps.db
          .select()
          .from(noteVersions)
          .where(eq(noteVersions.noteId, noteId))
          .orderBy(desc(noteVersions.versionNumber));

        const versions = results.map((r) => this.toProps(r));

        if (versions.length <= keepCount) {
          return 0;
        }

        // Keep the most recent versions
        const toDelete = versions.slice(keepCount);
        for (const version of toDelete) {
          await this.deps.db.delete(noteVersions).where(eq(noteVersions.id, version.id));
        }

        return toDelete.length;
      },
      { noteId, keepCount },
    );
  }

  async countByNoteId(noteId: string): Promise<number> {
    return this.handle(
      'countByNoteId',
      async () => {
        const results = await this.deps.db
          .select()
          .from(noteVersions)
          .where(eq(noteVersions.noteId, noteId));
        return results.length;
      },
      { noteId },
    );
  }

  private toProps(row: typeof noteVersions.$inferSelect): VersionProps {
    return {
      id: row.id,
      noteId: row.noteId,
      versionNumber: row.versionNumber,
      title: row.title,
      content: row.content,
      createdAt: row.createdAt,
    };
  }
}
