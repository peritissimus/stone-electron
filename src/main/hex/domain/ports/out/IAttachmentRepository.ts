/**
 * Attachment Repository Port
 *
 * Defines the contract for attachment persistence operations.
 */

import type { AttachmentProps, AttachmentEntity } from '../../entities';

export interface IAttachmentRepository {
  /**
   * Find attachment by ID
   */
  findById(id: string): Promise<AttachmentProps | null>;

  /**
   * Get all attachments for a note
   */
  findByNoteId(noteId: string): Promise<AttachmentProps[]>;

  /**
   * Get attachments for multiple notes (bulk operation)
   */
  findByNoteIds(noteIds: string[]): Promise<Map<string, AttachmentProps[]>>;

  /**
   * Save an attachment
   */
  save(attachment: AttachmentEntity): Promise<void>;

  /**
   * Delete an attachment
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all attachments for a note
   */
  deleteByNoteId(noteId: string): Promise<void>;

  /**
   * Check if attachment exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Count attachments for a note
   */
  countByNoteId(noteId: string): Promise<number>;
}
