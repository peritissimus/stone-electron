/**
 * NoteLinkRepository - Handles note-to-note link operations
 *
 * Manages the note_links junction table for wiki-style [[links]].
 */

import { eq, and, desc } from 'drizzle-orm';
import { getDatabaseManager } from '../database/DatabaseManager';
import { noteLinks, notes } from '../database/schema';
import type { Note } from '@shared/types';

export interface NoteLink {
  sourceNoteId: string;
  targetNoteId: string;
  createdAt: Date;
}

/**
 * NoteLinkRepository - Using Drizzle ORM
 */
export class NoteLinkRepository {
  /**
   * Get all links (for graph building)
   */
  async getAll(): Promise<NoteLink[]> {
    const db = getDatabaseManager().getDrizzle();
    const result = await db.select().from(noteLinks);
    return result;
  }

  /**
   * Get backlinks for a note (notes that link TO this note)
   */
  async getBacklinks(noteId: string): Promise<Note[]> {
    const db = getDatabaseManager().getDrizzle();

    const result = await db
      .select()
      .from(notes)
      .innerJoin(noteLinks, eq(notes.id, noteLinks.sourceNoteId))
      .where(and(eq(noteLinks.targetNoteId, noteId), eq(notes.isDeleted, false)))
      .orderBy(desc(notes.updatedAt));

    return result.map((row: { notes: Note }) => row.notes);
  }

  /**
   * Get forward links from a note (notes this note links TO)
   */
  async getForwardLinks(noteId: string): Promise<Note[]> {
    const db = getDatabaseManager().getDrizzle();

    const result = await db
      .select()
      .from(notes)
      .innerJoin(noteLinks, eq(notes.id, noteLinks.targetNoteId))
      .where(and(eq(noteLinks.sourceNoteId, noteId), eq(notes.isDeleted, false)))
      .orderBy(desc(notes.updatedAt));

    return result.map((row: { notes: Note }) => row.notes);
  }

  /**
   * Add a link between two notes
   */
  async addLink(sourceId: string, targetId: string): Promise<void> {
    const db = getDatabaseManager().getDrizzle();
    const now = new Date();

    await db
      .insert(noteLinks)
      .values({
        sourceNoteId: sourceId,
        targetNoteId: targetId,
        createdAt: now,
      })
      .onConflictDoNothing();
  }

  /**
   * Remove a link between two notes
   */
  async removeLink(sourceId: string, targetId: string): Promise<void> {
    const db = getDatabaseManager().getDrizzle();

    await db
      .delete(noteLinks)
      .where(and(eq(noteLinks.sourceNoteId, sourceId), eq(noteLinks.targetNoteId, targetId)));
  }

  /**
   * Remove all links from a note (when deleting a note)
   */
  async removeAllLinksFromNote(noteId: string): Promise<void> {
    const db = getDatabaseManager().getDrizzle();

    await db.delete(noteLinks).where(eq(noteLinks.sourceNoteId, noteId));
  }

  /**
   * Remove all links to a note (when deleting a note)
   */
  async removeAllLinksToNote(noteId: string): Promise<void> {
    const db = getDatabaseManager().getDrizzle();

    await db.delete(noteLinks).where(eq(noteLinks.targetNoteId, noteId));
  }

  /**
   * Check if a link exists between two notes
   */
  async linkExists(sourceId: string, targetId: string): Promise<boolean> {
    const db = getDatabaseManager().getDrizzle();

    const result = await db
      .select()
      .from(noteLinks)
      .where(and(eq(noteLinks.sourceNoteId, sourceId), eq(noteLinks.targetNoteId, targetId)))
      .limit(1);

    return result.length > 0;
  }

  /**
   * Count links for a note (both incoming and outgoing)
   */
  async countLinksForNote(noteId: string): Promise<{ incoming: number; outgoing: number }> {
    const db = getDatabaseManager().getDrizzle();

    const [incoming, outgoing] = await Promise.all([
      db.select().from(noteLinks).where(eq(noteLinks.targetNoteId, noteId)),
      db.select().from(noteLinks).where(eq(noteLinks.sourceNoteId, noteId)),
    ]);

    return {
      incoming: incoming.length,
      outgoing: outgoing.length,
    };
  }
}
