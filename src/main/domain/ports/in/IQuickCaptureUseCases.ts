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
  noteId: string;
  appended: boolean;
}

export interface TranscribeVoiceCaptureRequest {
  /** 16kHz mono 16-bit WAV bytes (same encoding the meeting recorder produces). */
  wav: Uint8Array;
  workspaceId?: string;
}

export interface TranscribeVoiceCaptureResponse {
  /** The transcript, trimmed. Empty string if Whisper heard nothing. */
  text: string;
  /** Audio duration in ms as reported by the decoder. */
  durationMs: number;
}

// Use case interfaces
export interface IAppendToJournalUseCase {
  execute(request: AppendToJournalRequest): Promise<AppendToJournalResponse>;
}

export interface ITranscribeVoiceCaptureUseCase {
  execute(request: TranscribeVoiceCaptureRequest): Promise<TranscribeVoiceCaptureResponse>;
}

/**
 * Aggregated quick capture use cases interface for DI container
 */
export interface IQuickCaptureUseCases {
  appendToJournal(
    content: string,
    workspaceId?: string,
  ): Promise<AppendToJournalResponse>;
  transcribeVoiceCapture(
    request: TranscribeVoiceCaptureRequest,
  ): Promise<TranscribeVoiceCaptureResponse>;
}
