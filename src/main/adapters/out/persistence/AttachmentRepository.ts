/**
 * Attachment Repository Implementation
 */

import { eq, and } from 'drizzle-orm';
import { attachments, type Database } from '../../../shared';
import type {
  IAttachmentRepository,
  AttachmentProps,
  AttachmentEntity,
} from '../../../domain';

export interface AttachmentRepositoryDeps {
  db: Database;
}

export class AttachmentRepository implements IAttachmentRepository {
  constructor(private deps: AttachmentRepositoryDeps) {}

  async findById(id: string): Promise<AttachmentProps | null> {
    const result = await this.deps.db
      .select()
      .from(attachments)
      .where(eq(attachments.id, id))
      .limit(1);

    if (result.length === 0) return null;
    return this.toProps(result[0]);
  }

  async findByNoteId(noteId: string): Promise<AttachmentProps[]> {
    const results = await this.deps.db
      .select()
      .from(attachments)
      .where(eq(attachments.noteId, noteId));

    return results.map((r) => this.toProps(r));
  }

  async findByNoteIds(noteIds: string[]): Promise<Map<string, AttachmentProps[]>> {
    const map = new Map<string, AttachmentProps[]>();
    for (const noteId of noteIds) {
      const results = await this.findByNoteId(noteId);
      map.set(noteId, results);
    }
    return map;
  }

  async save(attachment: AttachmentEntity): Promise<void> {
    await this.deps.db
      .insert(attachments)
      .values({
        id: attachment.id,
        noteId: attachment.noteId,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.size,
        path: attachment.path,
        createdAt: attachment.createdAt,
      })
      .onConflictDoUpdate({
        target: attachments.id,
        set: {
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          size: attachment.size,
          path: attachment.path,
        },
      });
  }

  async delete(id: string): Promise<void> {
    await this.deps.db.delete(attachments).where(eq(attachments.id, id));
  }

  async deleteByNoteId(noteId: string): Promise<void> {
    await this.deps.db.delete(attachments).where(eq(attachments.noteId, noteId));
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.deps.db
      .select({ id: attachments.id })
      .from(attachments)
      .where(eq(attachments.id, id))
      .limit(1);
    return result.length > 0;
  }

  async countByNoteId(noteId: string): Promise<number> {
    const results = await this.deps.db
      .select()
      .from(attachments)
      .where(eq(attachments.noteId, noteId));
    return results.length;
  }

  private toProps(row: typeof attachments.$inferSelect): AttachmentProps {
    return {
      id: row.id,
      noteId: row.noteId,
      filename: row.filename,
      mimeType: row.mimeType,
      size: row.size,
      path: row.path,
      createdAt: row.createdAt,
    };
  }
}
