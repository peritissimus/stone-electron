/**
 * Attachment Repository Implementation
 */

import { eq } from 'drizzle-orm';
import { attachments, type Database } from '../../../shared';
import type { IAttachmentRepository, AttachmentProps, AttachmentEntity } from '../../../domain';
import { handleOperation } from '../../../shared/utils';

export interface AttachmentRepositoryDeps {
  db: Database;
}

export class AttachmentRepository implements IAttachmentRepository {
  constructor(private deps: AttachmentRepositoryDeps) {}

  private handle<T>(operation: string, fn: () => Promise<T>, context?: Record<string, unknown>) {
    return handleOperation(fn, { adapter: 'AttachmentRepository', operation, context });
  }

  async findById(id: string): Promise<AttachmentProps | null> {
    return this.handle(
      'findById',
      async () => {
        const result = await this.deps.db
          .select()
          .from(attachments)
          .where(eq(attachments.id, id))
          .limit(1);

        if (result.length === 0) return null;
        return this.toProps(result[0]);
      },
      { attachmentId: id },
    );
  }

  async findByNoteId(noteId: string): Promise<AttachmentProps[]> {
    return this.handle(
      'findByNoteId',
      async () => {
        const results = await this.deps.db
          .select()
          .from(attachments)
          .where(eq(attachments.noteId, noteId));

        return results.map((r) => this.toProps(r));
      },
      { noteId },
    );
  }

  async findByNoteIds(noteIds: string[]): Promise<Map<string, AttachmentProps[]>> {
    return this.handle(
      'findByNoteIds',
      async () => {
        const map = new Map<string, AttachmentProps[]>();
        for (const noteId of noteIds) {
          const results = await this.deps.db
            .select()
            .from(attachments)
            .where(eq(attachments.noteId, noteId));
          map.set(noteId, results.map((r) => this.toProps(r)));
        }
        return map;
      },
      { noteIdCount: noteIds.length },
    );
  }

  async save(attachment: AttachmentEntity): Promise<void> {
    return this.handle(
      'save',
      async () => {
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
      },
      { attachmentId: attachment.id, noteId: attachment.noteId, filename: attachment.filename },
    );
  }

  async delete(id: string): Promise<void> {
    return this.handle(
      'delete',
      async () => {
        await this.deps.db.delete(attachments).where(eq(attachments.id, id));
      },
      { attachmentId: id },
    );
  }

  async deleteByNoteId(noteId: string): Promise<void> {
    return this.handle(
      'deleteByNoteId',
      async () => {
        await this.deps.db.delete(attachments).where(eq(attachments.noteId, noteId));
      },
      { noteId },
    );
  }

  async exists(id: string): Promise<boolean> {
    return this.handle(
      'exists',
      async () => {
        const result = await this.deps.db
          .select({ id: attachments.id })
          .from(attachments)
          .where(eq(attachments.id, id))
          .limit(1);
        return result.length > 0;
      },
      { attachmentId: id },
    );
  }

  async countByNoteId(noteId: string): Promise<number> {
    return this.handle(
      'countByNoteId',
      async () => {
        const results = await this.deps.db
          .select()
          .from(attachments)
          .where(eq(attachments.noteId, noteId));
        return results.length;
      },
      { noteId },
    );
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
