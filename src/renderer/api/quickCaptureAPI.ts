/**
 * Quick Capture API - IPC channel wrappers for quick capture operations
 *
 * Pure functions that wrap IPC channels. No React, no stores.
 */

import { invokeIpc } from '@renderer/lib/ipc';
import { QUICK_CAPTURE_CHANNELS } from '@shared/constants/ipcChannels';
import type { IpcResponse, Note } from '@shared/types';

export const quickCaptureAPI = {
  /**
   * Append text to today's journal entry
   */
  appendToJournal: (text: string): Promise<IpcResponse<{ note: Note }>> =>
    invokeIpc(QUICK_CAPTURE_CHANNELS.APPEND_TO_JOURNAL, { text }),
};
