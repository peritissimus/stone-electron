/**
 * Journal Reader Port (Outbound)
 *
 * Journal-specific read access. Splits a calendar date range into
 * `findByFilePathPrefix` plus per-file content reads, which would otherwise
 * leak journal pagination concerns into the generic `INoteRepository`.
 */

export interface JournalRecord {
  /** YYYY-MM-DD extracted from the file name. */
  date: string;
  noteId: string;
  filePath: string;
  /** Markdown content read from disk. Null if the file is unreadable. */
  content: string | null;
}

export interface FindRecentJournalsInput {
  workspaceId: string;
  workspaceFolderPath: string;
  journalFolder: string;
  /** Inclusive YYYY-MM-DD lower bound. */
  oldestDate: string;
  /** Inclusive YYYY-MM-DD upper bound. */
  newestDate: string;
}

export interface IJournalReader {
  findRecent(input: FindRecentJournalsInput): Promise<JournalRecord[]>;
}
