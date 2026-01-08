/**
 * Version Repository Port
 *
 * Defines the contract for note version persistence operations.
 */

import type { VersionProps, VersionEntity, VersionSummary } from '../../entities';

export interface IVersionRepository {
  /**
   * Find version by ID
   */
  findById(id: string): Promise<VersionProps | null>;

  /**
   * Create a new version snapshot
   */
  save(version: VersionEntity): Promise<void>;

  /**
   * Get next version number for a note
   */
  getNextVersionNumber(noteId: string): Promise<number>;

  /**
   * Get all versions for a note
   */
  findByNoteId(noteId: string): Promise<VersionProps[]>;

  /**
   * Get version history summary (without full content)
   */
  getVersionSummary(noteId: string): Promise<VersionSummary[]>;

  /**
   * Get latest version for a note
   */
  getLatestVersion(noteId: string): Promise<VersionProps | null>;

  /**
   * Delete all versions for a note
   */
  deleteByNoteId(noteId: string): Promise<void>;

  /**
   * Delete old versions (keep N most recent)
   */
  pruneVersions(noteId: string, keepCount: number): Promise<number>;

  /**
   * Count versions for a note
   */
  countByNoteId(noteId: string): Promise<number>;
}
