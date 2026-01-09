/**
 * Version Repository Implementation
 */

import { eq, desc, asc } from 'drizzle-orm';
import { noteVersions, type Database } from '../../../shared';
import type {
  IVersionRepository,
  VersionProps,
  VersionEntity,
  VersionSummary,
} from '../../../domain';

export interface VersionRepositoryDeps {
  db: Database;
}

export class VersionRepository implements IVersionRepository {
  constructor(private deps: VersionRepositoryDeps) {}

  async findById(id: string): Promise<VersionProps | null> {
    const result = await this.deps.db
      .select()
      .from(noteVersions)
      .where(eq(noteVersions.id, id))
      .limit(1);

    if (result.length === 0) return null;
    return this.toProps(result[0]);
  }

  async findByNoteId(noteId: string): Promise<VersionProps[]> {
    const results = await this.deps.db
      .select()
      .from(noteVersions)
      .where(eq(noteVersions.noteId, noteId))
      .orderBy(desc(noteVersions.versionNumber));

    return results.map((r) => this.toProps(r));
  }

  async getVersionSummary(noteId: string): Promise<VersionSummary[]> {
    const versions = await this.findByNoteId(noteId);
    return versions.map((v) => ({
      id: v.id,
      noteId: v.noteId,
      versionNumber: v.versionNumber,
      title: v.title,
      createdAt: v.createdAt,
      contentLength: v.content.length,
    }));
  }

  async getLatestVersion(noteId: string): Promise<VersionProps | null> {
    const result = await this.deps.db
      .select()
      .from(noteVersions)
      .where(eq(noteVersions.noteId, noteId))
      .orderBy(desc(noteVersions.versionNumber))
      .limit(1);

    if (result.length === 0) return null;
    return this.toProps(result[0]);
  }

  async getNextVersionNumber(noteId: string): Promise<number> {
    const latest = await this.getLatestVersion(noteId);
    return latest ? latest.versionNumber + 1 : 1;
  }

  async save(version: VersionEntity): Promise<void> {
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
  }

  async deleteByNoteId(noteId: string): Promise<void> {
    await this.deps.db.delete(noteVersions).where(eq(noteVersions.noteId, noteId));
  }

  async pruneVersions(noteId: string, keepCount: number): Promise<number> {
    const versions = await this.findByNoteId(noteId);

    if (versions.length <= keepCount) {
      return 0;
    }

    // Keep the most recent versions
    const toDelete = versions.slice(keepCount);
    for (const version of toDelete) {
      await this.deps.db.delete(noteVersions).where(eq(noteVersions.id, version.id));
    }

    return toDelete.length;
  }

  async countByNoteId(noteId: string): Promise<number> {
    const results = await this.deps.db
      .select()
      .from(noteVersions)
      .where(eq(noteVersions.noteId, noteId));
    return results.length;
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
