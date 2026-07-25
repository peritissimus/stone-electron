/**
 * Quick Capture Use Cases Port
 *
 * Defines the contract for quick capture operations.
 */
import { Context } from 'effect';
import type { Effect } from 'effect';

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
  execute(
    request: AppendToJournalRequest,
  ): Effect.Effect<AppendToJournalResponse, Error>;
}

export interface ITranscribeVoiceCaptureUseCase {
  execute(
    request: TranscribeVoiceCaptureRequest,
  ): Effect.Effect<TranscribeVoiceCaptureResponse, Error>;
}

/**
 * Aggregated quick capture use cases interface for DI container
 */
export interface IQuickCaptureUseCases {
  appendToJournal(
    content: string,
    workspaceId?: string,
  ): Effect.Effect<AppendToJournalResponse, Error>;
  transcribeVoiceCapture(
    request: TranscribeVoiceCaptureRequest,
  ): Effect.Effect<TranscribeVoiceCaptureResponse, Error>;
}

export const QuickCaptureUseCasesPort =
  Context.GenericTag<IQuickCaptureUseCases>('stone/IQuickCaptureUseCases');
