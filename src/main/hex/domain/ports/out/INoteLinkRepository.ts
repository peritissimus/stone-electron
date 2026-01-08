/**
 * NoteLink Repository Port
 *
 * Defines the contract for note link persistence operations.
 */

import type { NoteLinkProps, NoteLinkEntity, LinkCount } from '../../entities';
import type { NoteProps } from '../../entities';

export interface INoteLinkRepository {
  /**
   * Get all links
   */
  findAll(): Promise<NoteLinkProps[]>;

  /**
   * Get backlinks for a note (notes that link TO this note)
   */
  getBacklinks(noteId: string): Promise<NoteProps[]>;

  /**
   * Get forward links from a note (notes this note links TO)
   */
  getForwardLinks(noteId: string): Promise<NoteProps[]>;

  /**
   * Add a link between two notes
   */
  save(link: NoteLinkEntity): Promise<void>;

  /**
   * Remove a link between two notes
   */
  delete(sourceId: string, targetId: string): Promise<void>;

  /**
   * Remove all links from a note
   */
  deleteFromNote(noteId: string): Promise<void>;

  /**
   * Remove all links to a note
   */
  deleteToNote(noteId: string): Promise<void>;

  /**
   * Remove all links involving a note (both directions)
   */
  deleteAllForNote(noteId: string): Promise<void>;

  /**
   * Check if a link exists
   */
  exists(sourceId: string, targetId: string): Promise<boolean>;

  /**
   * Count links for a note
   */
  countForNote(noteId: string): Promise<LinkCount>;

  /**
   * Set links for a note (replace all outgoing links)
   */
  setLinksFromNote(sourceId: string, targetIds: string[]): Promise<void>;
}
