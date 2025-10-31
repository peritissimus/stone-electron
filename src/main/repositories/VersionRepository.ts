/**
 * VersionRepository - Handles note version history
 */

import { eq, sql, desc } from 'drizzle-orm';
import { getDatabaseManager } from '../database/DatabaseManager';
import { noteVersions } from '../database/schema';
import type { NoteVersion, InsertNoteVersion } from '@shared/types';
import { nanoid } from 'nanoid';

/**
 * Version Repository - Using Drizzle ORM
 */
export class VersionRepository {
  /**
   * Find version by ID
   */
  async findById(id: string): Promise<NoteVersion | undefined> {
    const db = getDatabaseManager().getDrizzle();
    const result = await db.select().from(noteVersions).where(eq(noteVersions.id, id)).limit(1);
    return result[0];
  }

  /**
   * Create a new version snapshot
   */
  async createVersion(noteId: string, title: string, content: string): Promise<NoteVersion> {
    const db = getDatabaseManager().getDrizzle();
    const versionNumber = await this.getNextVersionNumber(noteId);
    const now = new Date();

    const newVersion: InsertNoteVersion = {
      id: nanoid(),
      noteId,
      title,
      content,
      versionNumber,
      createdAt: now,
    };

    await db.insert(noteVersions).values(newVersion);
    return newVersion as NoteVersion;
  }

  /**
   * Get next version number for a note
   */
  private async getNextVersionNumber(noteId: string): Promise<number> {
    const db = getDatabaseManager().getDrizzle();

    const result = await db
      .select({ maxVersion: sql<number>`MAX(${noteVersions.versionNumber})` })
      .from(noteVersions)
      .where(eq(noteVersions.noteId, noteId));

    return (result[0]?.maxVersion || 0) + 1;
  }

  /**
   * Get version history summary
   */
  async getVersionSummary(noteId: string): Promise<
    Array<{
      versionNumber: number;
      title: string;
      createdAt: Date;
      contentLength: number;
    }>
  > {
    const db = getDatabaseManager().getDrizzle();

    const result = await db
      .select({
        versionNumber: noteVersions.versionNumber,
        title: noteVersions.title,
        createdAt: noteVersions.createdAt,
        contentLength: sql<number>`LENGTH(${noteVersions.content})`,
      })
      .from(noteVersions)
      .where(eq(noteVersions.noteId, noteId))
      .orderBy(desc(noteVersions.versionNumber));

    return result as Array<{
      versionNumber: number;
      title: string;
      createdAt: Date;
      contentLength: number;
    }>;
  }
}
