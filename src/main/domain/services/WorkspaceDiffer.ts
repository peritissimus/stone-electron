/**
 * WorkspaceDiffer - Pure domain service for reconciling workspace filesystem state
 * with database state during a sync operation.
 *
 * Encapsulates the business rule for classifying markdown files during workspace sync:
 * - `added`:      files present on disk but not yet tracked in the database
 * - `modified`:   files that exist in both but whose mtime is newer than the DB row's updatedAt
 * - `unchanged`:  files that exist in both but have not been modified on disk
 * - `removed`:    DB rows whose filePath no longer exists on disk (and are not already soft-deleted)
 *
 * This service does NO I/O. Callers must load filesystem entries and database entries first,
 * then pass them in as plain data.
 */

export interface FsEntry {
  /** Relative path within the workspace (e.g. "notes/foo.md"). */
  relativePath: string;
  /** Last modified time from the filesystem. */
  modifiedAt: Date;
}

export interface DbEntry {
  /** Persisted note identifier. */
  id: string;
  /** Relative path stored on the note. May be null for notes without a file. */
  filePath: string | null;
  /** Last updated timestamp in the database. */
  updatedAt: Date;
  /** Whether the note is soft-deleted. */
  isDeleted: boolean;
}

export interface AddedEntry {
  relativePath: string;
  modifiedAt: Date;
}

export interface ModifiedEntry {
  relativePath: string;
  modifiedAt: Date;
  dbId: string;
}

export interface UnchangedEntry {
  relativePath: string;
  dbId: string;
}

export interface RemovedEntry {
  dbId: string;
  filePath: string;
}

export interface WorkspaceDiffPlan {
  added: AddedEntry[];
  modified: ModifiedEntry[];
  unchanged: UnchangedEntry[];
  removed: RemovedEntry[];
}

export const WorkspaceDiffer = {
  diff(fsEntries: FsEntry[], dbEntries: DbEntry[]): WorkspaceDiffPlan {
    const dbByPath = new Map<string, DbEntry>();
    for (const entry of dbEntries) {
      if (entry.filePath) {
        dbByPath.set(entry.filePath, entry);
      }
    }

    const seenPaths = new Set<string>();

    const added: AddedEntry[] = [];
    const modified: ModifiedEntry[] = [];
    const unchanged: UnchangedEntry[] = [];

    for (const fsEntry of fsEntries) {
      seenPaths.add(fsEntry.relativePath);
      const dbEntry = dbByPath.get(fsEntry.relativePath);

      if (!dbEntry) {
        added.push({
          relativePath: fsEntry.relativePath,
          modifiedAt: fsEntry.modifiedAt,
        });
      } else if (dbEntry.updatedAt < fsEntry.modifiedAt) {
        modified.push({
          relativePath: fsEntry.relativePath,
          modifiedAt: fsEntry.modifiedAt,
          dbId: dbEntry.id,
        });
      } else {
        unchanged.push({
          relativePath: fsEntry.relativePath,
          dbId: dbEntry.id,
        });
      }
    }

    const removed: RemovedEntry[] = [];
    for (const dbEntry of dbEntries) {
      if (
        dbEntry.filePath &&
        !seenPaths.has(dbEntry.filePath) &&
        !dbEntry.isDeleted
      ) {
        removed.push({ dbId: dbEntry.id, filePath: dbEntry.filePath });
      }
    }

    return { added, modified, unchanged, removed };
  },
};
