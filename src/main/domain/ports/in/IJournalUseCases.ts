/**
 * Journal Use Cases Port
 *
 * Defines operations for the journal destination. Journal folder, filename
 * pattern, and seed content are encapsulated by the implementation — callers
 * only hand over a date and receive a note id.
 */

export interface OpenOrCreateJournalForDateRequest {
  /** ISO date string (YYYY-MM-DD) or full ISO timestamp */
  date: string;
  /** Optional workspace override; defaults to active workspace */
  workspaceId?: string;
}

export interface OpenOrCreateJournalForDateResponse {
  noteId: string;
  created: boolean;
}

export interface IJournalUseCases {
  openOrCreateForDate(
    request: OpenOrCreateJournalForDateRequest,
  ): Promise<OpenOrCreateJournalForDateResponse>;
}
