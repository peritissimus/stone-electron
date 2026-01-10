/**
 * NoteLink Repository Implementation
 */

import { eq, and, or } from 'drizzle-orm';
import { noteLinks, notes, type Database } from '../../../shared';
import type {
  INoteLinkRepository,
  NoteLinkProps,
  NoteLinkEntity,
  LinkCount,
  NoteProps,
} from '../../../domain';
import { handleOperation } from '../../../shared/utils';

export interface NoteLinkRepositoryDeps {
  db: Database;
}

export class NoteLinkRepository implements INoteLinkRepository {
  constructor(private deps: NoteLinkRepositoryDeps) {}

  private handle<T>(operation: string, fn: () => Promise<T>, context?: Record<string, unknown>) {
    return handleOperation(fn, { adapter: 'NoteLinkRepository', operation, context });
  }

  async findAll(): Promise<NoteLinkProps[]> {
    return this.handle('findAll', async () => {
      const results = await this.deps.db.select().from(noteLinks);
      return results.map((r) => this.toProps(r));
    });
  }

  async getBacklinks(noteId: string): Promise<NoteProps[]> {
    return this.handle(
      'getBacklinks',
      async () => {
        // Get notes that link TO this note
        const links = await this.deps.db
          .select()
          .from(noteLinks)
          .where(eq(noteLinks.targetNoteId, noteId));

        const sourceNotes: NoteProps[] = [];
        for (const link of links) {
          const noteResults = await this.deps.db
            .select()
            .from(notes)
            .where(eq(notes.id, link.sourceNoteId))
            .limit(1);

          if (noteResults.length > 0) {
            sourceNotes.push(this.noteToProps(noteResults[0]));
          }
        }
        return sourceNotes;
      },
      { noteId },
    );
  }

  async getForwardLinks(noteId: string): Promise<NoteProps[]> {
    return this.handle(
      'getForwardLinks',
      async () => {
        // Get notes this note links TO
        const links = await this.deps.db
          .select()
          .from(noteLinks)
          .where(eq(noteLinks.sourceNoteId, noteId));

        const targetNotes: NoteProps[] = [];
        for (const link of links) {
          const noteResults = await this.deps.db
            .select()
            .from(notes)
            .where(eq(notes.id, link.targetNoteId))
            .limit(1);

          if (noteResults.length > 0) {
            targetNotes.push(this.noteToProps(noteResults[0]));
          }
        }
        return targetNotes;
      },
      { noteId },
    );
  }

  async save(link: NoteLinkEntity): Promise<void> {
    return this.handle(
      'save',
      async () => {
        await this.deps.db
          .insert(noteLinks)
          .values({
            sourceNoteId: link.sourceNoteId,
            targetNoteId: link.targetNoteId,
            createdAt: link.createdAt,
          })
          .onConflictDoNothing();
      },
      { sourceNoteId: link.sourceNoteId, targetNoteId: link.targetNoteId },
    );
  }

  async delete(sourceId: string, targetId: string): Promise<void> {
    return this.handle(
      'delete',
      async () => {
        await this.deps.db
          .delete(noteLinks)
          .where(and(eq(noteLinks.sourceNoteId, sourceId), eq(noteLinks.targetNoteId, targetId)));
      },
      { sourceNoteId: sourceId, targetNoteId: targetId },
    );
  }

  async deleteFromNote(noteId: string): Promise<void> {
    return this.handle(
      'deleteFromNote',
      async () => {
        await this.deps.db.delete(noteLinks).where(eq(noteLinks.sourceNoteId, noteId));
      },
      { noteId },
    );
  }

  async deleteToNote(noteId: string): Promise<void> {
    return this.handle(
      'deleteToNote',
      async () => {
        await this.deps.db.delete(noteLinks).where(eq(noteLinks.targetNoteId, noteId));
      },
      { noteId },
    );
  }

  async deleteAllForNote(noteId: string): Promise<void> {
    return this.handle(
      'deleteAllForNote',
      async () => {
        await this.deps.db
          .delete(noteLinks)
          .where(or(eq(noteLinks.sourceNoteId, noteId), eq(noteLinks.targetNoteId, noteId)));
      },
      { noteId },
    );
  }

  async exists(sourceId: string, targetId: string): Promise<boolean> {
    return this.handle(
      'exists',
      async () => {
        const result = await this.deps.db
          .select()
          .from(noteLinks)
          .where(and(eq(noteLinks.sourceNoteId, sourceId), eq(noteLinks.targetNoteId, targetId)))
          .limit(1);
        return result.length > 0;
      },
      { sourceNoteId: sourceId, targetNoteId: targetId },
    );
  }

  async countForNote(noteId: string): Promise<LinkCount> {
    return this.handle(
      'countForNote',
      async () => {
        const fromLinks = await this.deps.db
          .select()
          .from(noteLinks)
          .where(eq(noteLinks.sourceNoteId, noteId));

        const toLinks = await this.deps.db
          .select()
          .from(noteLinks)
          .where(eq(noteLinks.targetNoteId, noteId));

        return {
          outgoing: fromLinks.length,
          incoming: toLinks.length,
        };
      },
      { noteId },
    );
  }

  async setLinksFromNote(sourceId: string, targetIds: string[]): Promise<void> {
    return this.handle(
      'setLinksFromNote',
      async () => {
        // Delete all existing links from this note
        await this.deps.db.delete(noteLinks).where(eq(noteLinks.sourceNoteId, sourceId));

        // Insert new links
        for (const targetId of targetIds) {
          await this.deps.db.insert(noteLinks).values({
            sourceNoteId: sourceId,
            targetNoteId: targetId,
            createdAt: new Date(),
          });
        }
      },
      { sourceNoteId: sourceId, targetCount: targetIds.length },
    );
  }

  private toProps(row: typeof noteLinks.$inferSelect): NoteLinkProps {
    return {
      sourceNoteId: row.sourceNoteId,
      targetNoteId: row.targetNoteId,
      createdAt: row.createdAt,
    };
  }

  private noteToProps(row: typeof notes.$inferSelect): NoteProps {
    return {
      id: row.id,
      title: row.title ?? 'Untitled',
      filePath: row.filePath,
      notebookId: row.notebookId,
      workspaceId: row.workspaceId,
      isFavorite: row.isFavorite ?? false,
      isPinned: row.isPinned ?? false,
      isArchived: row.isArchived ?? false,
      isDeleted: row.isDeleted ?? false,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
