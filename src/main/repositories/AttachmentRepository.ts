/**
 * AttachmentRepository - Handles file attachment metadata
 */

import { eq, and, sql, desc } from 'drizzle-orm';
import { getDatabaseManager } from '../database/DatabaseManager';
import { attachments } from '../database/schema';
import type { Attachment, InsertAttachment } from '@shared/types';
import { nanoid } from 'nanoid';

/**
 * Attachment Repository - Using Drizzle ORM
 */
export class AttachmentRepository {
  /**
   * Create a new attachment
   */
  async create(data: Partial<InsertAttachment>): Promise<Attachment> {
    const db = getDatabaseManager().getDrizzle();
    const now = new Date();

    const newAttachment: InsertAttachment = {
      id: nanoid(),
      noteId: data.noteId!,
      filename: data.filename!,
      mimeType: data.mimeType!,
      size: data.size!,
      path: data.path!,
      createdAt: now,
    };

    await db.insert(attachments).values(newAttachment);
    return newAttachment as Attachment;
  }

  /**
   * Find attachment by ID
   */
  async findById(id: string): Promise<Attachment | undefined> {
    const db = getDatabaseManager().getDrizzle();
    const result = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
    return result[0];
  }

  /**
   * Delete attachment
   */
  async delete(id: string): Promise<boolean> {
    const db = getDatabaseManager().getDrizzle();
    await db.delete(attachments).where(eq(attachments.id, id));
    return true;
  }

  /**
   * Get all attachments for a note
   */
  async getAttachmentsForNote(noteId: string): Promise<Attachment[]> {
    const db = getDatabaseManager().getDrizzle();

    const result = await db
      .select()
      .from(attachments)
      .where(eq(attachments.noteId, noteId))
      .orderBy(desc(attachments.createdAt));

    return result as Attachment[];
  }

  /**
   * Get attachments for multiple notes (bulk operation)
   * Returns a Map with noteId as key and array of attachments as value
   */
  async getAttachmentsForNotes(noteIds: string[]): Promise<Map<string, Attachment[]>> {
    const db = getDatabaseManager().getDrizzle();

    if (noteIds.length === 0) {
      return new Map();
    }

    const result = await db
      .select()
      .from(attachments)
      .where(sql`${attachments.noteId} IN (${sql.join(noteIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(desc(attachments.createdAt));

    // Group attachments by noteId
    const attachmentsByNote = new Map<string, Attachment[]>();

    for (const attachment of result) {
      if (!attachmentsByNote.has(attachment.noteId)) {
        attachmentsByNote.set(attachment.noteId, []);
      }
      attachmentsByNote.get(attachment.noteId)!.push(attachment as Attachment);
    }

    return attachmentsByNote;
  }
}
