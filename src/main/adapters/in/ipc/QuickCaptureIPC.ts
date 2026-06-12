/**
 * Quick Capture IPC Adapter - Handles quick capture IPC channels
 */

import { ipcMain } from 'electron';
import { QUICK_CAPTURE_CHANNELS } from '@shared/constants/ipcChannels';
import {
  AppendToJournalRequestSchema,
  type AppendToJournalResponse,
  type TranscribeVoiceResponse,
} from '@shared/schemas';
import { COMMON_IPC_ERROR_MAP, handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface QuickCaptureIPCDeps {
  appendToJournal: (
    content: string,
    workspaceId?: string,
  ) => Promise<{ noteId: string; appended: boolean }>;
  transcribeVoiceCapture: (request: {
    wav: Uint8Array;
    workspaceId?: string;
  }) => Promise<{ text: string; durationMs: number }>;
}

export function registerQuickCaptureHandlers(deps: QuickCaptureIPCDeps): void {
  const { appendToJournal, transcribeVoiceCapture } = deps;

  ipcMain.handle(QUICK_CAPTURE_CHANNELS.APPEND_TO_JOURNAL, async (_event, rawRequest) => {
    const request = AppendToJournalRequestSchema.parse(rawRequest);
    // Accept both 'text' and 'content' for flexibility.
    const text = request.text ?? request.content ?? '';
    return handleIpcRequest<AppendToJournalResponse>(
      async () => appendToJournal(text, request.workspaceId),
      {
        loggerPrefix: 'QuickCaptureIPC',
        defaultCode: 'QUICK_CAPTURE_ERROR',
        errorMap: { ...COMMON_IPC_ERROR_MAP },
        context: {
          channel: QUICK_CAPTURE_CHANNELS.APPEND_TO_JOURNAL,
          workspaceId: request.workspaceId,
          textLength: text.length,
        },
      },
    );
  });

  // WAV bytes arrive as ArrayBuffer via structured clone (same transport as
  // the meeting recorder's appendAudio) — validated by type check, not zod.
  ipcMain.handle(QUICK_CAPTURE_CHANNELS.TRANSCRIBE_VOICE, async (_event, rawRequest) => {
    const wav = rawRequest?.wav;
    const workspaceId: string | undefined =
      typeof rawRequest?.workspaceId === 'string' ? rawRequest.workspaceId : undefined;
    return handleIpcRequest<TranscribeVoiceResponse>(
      async () => {
        if (!(wav instanceof ArrayBuffer) && !ArrayBuffer.isView(wav)) {
          throw new Error('transcribeVoice expects a WAV ArrayBuffer in `wav`');
        }
        const bytes =
          wav instanceof ArrayBuffer
            ? new Uint8Array(wav)
            : new Uint8Array(wav.buffer, wav.byteOffset, wav.byteLength);
        return transcribeVoiceCapture({ wav: bytes, workspaceId });
      },
      {
        loggerPrefix: 'QuickCaptureIPC',
        defaultCode: 'QUICK_CAPTURE_ERROR',
        errorMap: { ...COMMON_IPC_ERROR_MAP },
        context: {
          channel: QUICK_CAPTURE_CHANNELS.TRANSCRIBE_VOICE,
          workspaceId,
          wavBytes: wav instanceof ArrayBuffer ? wav.byteLength : (wav?.byteLength ?? 0),
        },
      },
    );
  });

  logger.info('[IPC] QuickCapture handlers registered');
}

export function unregisterQuickCaptureHandlers(): void {
  ipcMain.removeHandler(QUICK_CAPTURE_CHANNELS.APPEND_TO_JOURNAL);
  ipcMain.removeHandler(QUICK_CAPTURE_CHANNELS.TRANSCRIBE_VOICE);
}
