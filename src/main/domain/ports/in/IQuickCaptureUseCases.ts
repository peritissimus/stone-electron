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

/**
 * Aggregated quick capture use cases interface for DI container
 */
export interface IQuickCaptureUseCases {
  appendToJournal(
    content: string,
    workspaceId?: string,
  ): Promise<{ noteId: string; appended: boolean }>;
}
