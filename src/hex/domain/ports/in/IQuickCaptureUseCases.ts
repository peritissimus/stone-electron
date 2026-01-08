/**
 * Quick Capture Use Cases Port
 *
 * Defines the contract for quick capture operations.
 */

// Request/Response types
export interface AppendToJournalRequest {
  text: string;
}

export interface AppendToJournalResponse {
  success: boolean;
  noteId: string;
}

// Use case interfaces
export interface IAppendToJournalUseCase {
  execute(request: AppendToJournalRequest): Promise<AppendToJournalResponse>;
}
