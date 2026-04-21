/**
 * Journal API - IPC channel wrappers for the journal destination
 *
 * Thin wrappers around the journal IPC. No React, no stores.
 */

import { z } from 'zod';
import { invokeIpc } from '@renderer/lib/ipc';
import { JOURNAL_CHANNELS } from '@shared/constants/ipcChannels';
import type { IpcResponse } from '@shared/types';
import { validateResponse } from './validation';

const OpenOrCreateJournalResponseSchema = z.object({
  noteId: z.string(),
  created: z.boolean(),
});

export interface OpenOrCreateJournalResponse {
  noteId: string;
  created: boolean;
}

export const journalAPI = {
  /**
   * Resolve the journal note for a given date, creating it if it doesn't exist.
   * `date` should be an ISO date (YYYY-MM-DD) or full ISO timestamp.
   */
  openOrCreateForDate: async (
    date: string,
    workspaceId?: string,
  ): Promise<IpcResponse<OpenOrCreateJournalResponse>> => {
    const response = await invokeIpc(JOURNAL_CHANNELS.OPEN_OR_CREATE_FOR_DATE, {
      date,
      workspaceId,
    });
    return validateResponse(response, OpenOrCreateJournalResponseSchema);
  },
};
