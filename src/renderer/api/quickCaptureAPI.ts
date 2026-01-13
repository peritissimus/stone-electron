/**
 * Quick Capture API - IPC channel wrappers for quick capture operations
 *
 * Pure functions that wrap IPC channels. No React, no stores.
 */

import { z } from 'zod';
import { invokeIpc } from '@renderer/lib/ipc';
import { QUICK_CAPTURE_CHANNELS } from '@shared/constants/ipcChannels';
import type { IpcResponse, Note } from '@shared/types';
import { validateResponse } from './validation';
import { NoteSchema } from './schemas';

export const quickCaptureAPI = {
  /**
   * Append text to today's journal entry
   */
  appendToJournal: async (text: string): Promise<IpcResponse<{ note: Note }>> => {
    const response = await invokeIpc(QUICK_CAPTURE_CHANNELS.APPEND_TO_JOURNAL, { text });
    return validateResponse(response, z.object({ note: NoteSchema }));
  },
};
