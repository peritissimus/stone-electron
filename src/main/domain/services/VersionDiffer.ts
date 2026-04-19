/**
 * VersionDiffer - Pure domain service for version snapshot business rules.
 *
 * Encapsulates pure logic around note versions:
 * - generating the canonical version ID for a given note + version number
 * - validating that a loaded version actually belongs to a given note
 * - producing the VersionSnapshot DTO shape from a persisted version
 *
 * NOTE: This module intentionally contains no text-diffing algorithm. The
 * current feature set only stores full content snapshots and restores them
 * verbatim; once we introduce real diffing (e.g. via `diff` or `jsdiff`) that
 * will need to live behind an OUT port, not in domain/services/.
 */

export interface VersionLike {
  id: string;
  noteId: string;
  versionNumber: number;
  content: string;
  title: string;
  createdAt: Date;
}

export interface VersionSnapshotDTO {
  id: string;
  noteId: string;
  versionNumber: number;
  content: string;
  title: string;
  createdAt: Date;
}

export const VersionDiffer = {
  /**
   * Canonical version ID format. The application layer generates IDs via this
   * function so that the naming rule lives in one place.
   */
  buildVersionId(noteId: string, versionNumber: number): string {
    return `${noteId}-v${versionNumber}`;
  },

  /**
   * Returns true when the version belongs to the given note. Use cases rely on
   * this invariant before restoring or returning a version.
   */
  belongsToNote(version: Pick<VersionLike, 'noteId'>, noteId: string): boolean {
    return version.noteId === noteId;
  },

  /**
   * Map a persisted version (or version entity snapshot) to the outbound
   * VersionSnapshot DTO. Keeps the DTO shape in one place so use cases don't
   * each hand-roll the projection.
   */
  toSnapshot(version: VersionLike): VersionSnapshotDTO {
    return {
      id: version.id,
      noteId: version.noteId,
      versionNumber: version.versionNumber,
      content: version.content,
      title: version.title,
      createdAt: version.createdAt,
    };
  },
};
