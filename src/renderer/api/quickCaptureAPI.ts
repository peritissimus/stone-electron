/**
 * Quick Capture API - IPC channel wrappers for quick capture operations
 *
 * Pure functions that wrap IPC channels. No React, no stores.
 * No spec counterpart: desktop-tray feature, not in cross-platform contract yet.
 */

import { invokeIpc } from '@renderer/lib/ipc';
import { QUICK_CAPTURE_CHANNELS } from '@shared/constants/ipcChannels';
import type { IpcResponse } from '@shared/types';
import {
  AppendToJournalResponseSchema,
  TranscribeVoiceResponseSchema,
  type AppendToJournalResponse,
  type TranscribeVoiceResponse,
} from '@shared/schemas';
import { validateResponse } from './validation';

export type { AppendToJournalResponse, TranscribeVoiceResponse };

export const quickCaptureAPI = {
  /**
   * Append text to today's journal entry
   */
  appendToJournal: async (text: string): Promise<IpcResponse<AppendToJournalResponse>> => {
    const response = await invokeIpc(QUICK_CAPTURE_CHANNELS.APPEND_TO_JOURNAL, { text });
    return validateResponse(response, AppendToJournalResponseSchema);
  },

  /**
   * Transcribe a voice capture (16kHz mono WAV) via the local Whisper model.
   * The ArrayBuffer travels by structured clone, same as meeting audio.
   */
  transcribeVoice: async (wav: ArrayBuffer): Promise<IpcResponse<TranscribeVoiceResponse>> => {
    const response = await invokeIpc(QUICK_CAPTURE_CHANNELS.TRANSCRIBE_VOICE, { wav });
    return validateResponse(response, TranscribeVoiceResponseSchema);
  },
};
