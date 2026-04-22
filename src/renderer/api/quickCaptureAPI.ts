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
  type AppendToJournalResponse,
} from '@shared/schemas';
import { validateResponse } from './validation';

export type { AppendToJournalResponse };

export const quickCaptureAPI = {
  /**
   * Append text to today's journal entry
   */
  appendToJournal: async (text: string): Promise<IpcResponse<AppendToJournalResponse>> => {
    const response = await invokeIpc(QUICK_CAPTURE_CHANNELS.APPEND_TO_JOURNAL, { text });
    return validateResponse(response, AppendToJournalResponseSchema);
  },
};
